import { BookRelationshipsQueryDto } from '@books/application/dto/book-relationships-query.dto';
import { CreateBookRelationshipDto } from '@books/application/dto/create-book-relationship.dto';
import { UpdateBookRelationshipDto } from '@books/application/dto/update-book-relationship.dto';
import {
	IBookRelationshipRepository,
	I_BOOK_RELATIONSHIP_REPOSITORY,
} from '@books/application/ports/book-relationship-repository.interface';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import { Book } from '@books/domain/entities/book';
import {
	BookRelationship,
	BookRelationshipMetadata,
} from '@books/domain/entities/book-relationship';
import { BookRelationType } from '@books/domain/enums/book-relation-type.enum';
import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/common/pagination/cursor.utils';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';

export type RelatedBookItem = {
	relationId: string;
	relationType: string;
	isBidirectional: boolean;
	order: number | null;
	metadata: BookRelationshipMetadata | null;
	direction: 'incoming' | 'outgoing';
	relatedBook: Omit<Book, 'covers'> & {
		cover: string | null;
		coverMetadata: ImageMetadata | null;
	};
	createdAt: Date;
};

type BookRelationshipsCursorPayload = {
	relationType?: string;
	order: number | null;
	createdAt: string;
	id: string;
};

@Injectable()
export class BookBookRelationshipService {
	private readonly relationshipNullOrderValue = 2147483647;

	constructor(
		@Inject(I_BOOK_RELATIONSHIP_REPOSITORY)
		private readonly bookRelationshipRepository: IBookRelationshipRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly userAccessPolicyService: UserAccessPolicyService,
		private readonly mediaUrlService: MediaUrlService,
	) {}

	async createRelationship(
		sourceBookId: string,
		dto: CreateBookRelationshipDto,
	): Promise<BookRelationship> {
		if (sourceBookId === dto.targetBookId) {
			throw new BadRequestException(
				'Não é possível criar relacionamento do livro com ele mesmo.',
			);
		}

		await this.ensureBooksExist(sourceBookId, dto.targetBookId);

		const normalizedPair = this.normalizePair(
			sourceBookId,
			dto.targetBookId,
			dto.isBidirectional ?? false,
		);

		const existing = await this.bookRelationshipRepository.findOneBy({
			sourceBookId: normalizedPair.sourceBookId,
			targetBookId: normalizedPair.targetBookId,
			relationType: dto.relationType,
		});

		if (existing) {
			throw new ConflictException(
				'Já existe uma relação desse tipo entre os livros informados.',
			);
		}

		const entity = new BookRelationship();
		Object.assign(entity, {
			sourceBookId: normalizedPair.sourceBookId,
			targetBookId: normalizedPair.targetBookId,
			relationType: dto.relationType,
			isBidirectional: dto.isBidirectional ?? false,
			order: dto.order ?? null,
			metadata: this.buildMetadata(dto.note, dto.weight),
		});

		const saved = await this.bookRelationshipRepository.save(entity);
		return saved;
	}

	async updateRelationship(
		idBook: string,
		idRelationship: string,
		dto: UpdateBookRelationshipDto,
	): Promise<BookRelationship> {
		const relationship = await this.getRelationshipById(idRelationship);
		this.ensureRelationshipBelongsToBook(relationship, idBook);

		const nextBidirectional =
			dto.isBidirectional ?? relationship.isBidirectional;

		const normalizedPair = this.normalizePair(
			relationship.sourceBookId,
			relationship.targetBookId,
			nextBidirectional,
		);
		const nextRelationType = dto.relationType ?? relationship.relationType;

		const duplicate = await this.bookRelationshipRepository.findOneBy({
			sourceBookId: normalizedPair.sourceBookId,
			targetBookId: normalizedPair.targetBookId,
			relationType: nextRelationType,
		});

		if (duplicate && duplicate.id !== relationship.id) {
			throw new ConflictException(
				'Já existe uma relação desse tipo entre os livros informados.',
			);
		}

		relationship.sourceBookId = normalizedPair.sourceBookId;
		relationship.targetBookId = normalizedPair.targetBookId;
		relationship.relationType = nextRelationType;
		relationship.isBidirectional = nextBidirectional;
		relationship.order = dto.order ?? relationship.order;

		if (dto.note !== undefined || dto.weight !== undefined) {
			relationship.metadata = this.buildMetadata(
				dto.note ?? relationship.metadata?.note,
				dto.weight ?? relationship.metadata?.weight,
			);
		}

		await this.bookRelationshipRepository.save(relationship);

		if (relationship.sourceBookId !== relationship.sourceBook?.id) {
			const temp = relationship.sourceBook;
			relationship.sourceBook = relationship.targetBook;
			relationship.targetBook = temp;
		}

		return relationship;
	}

	async deleteRelationship(idBook: string, idRelationship: string) {
		const relationship = await this.getRelationshipById(idRelationship);
		this.ensureRelationshipBelongsToBook(relationship, idBook);

		await this.bookRelationshipRepository.softDelete(idRelationship);
		return { deleted: true, idRelationship };
	}

	async listRelationships(
		idBook: string,
		query: BookRelationshipsQueryDto,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		const bookExists = await this.bookRepository.exists(idBook);

		if (!bookExists) {
			throw new NotFoundException('Livro não encontrado.');
		}

		const relationships =
			await this.bookRelationshipRepository.findRelationshipsByBookId(
				idBook,
			);

		let items: RelatedBookItem[] = relationships.map((rel) => {
			const isSource = rel.sourceBookId === idBook;
			const relatedBookSource = isSource
				? rel.targetBook
				: rel.sourceBook;
			const direction =
				rel.isBidirectional || isSource ? 'outgoing' : 'incoming';

			const selectedCover =
				relatedBookSource.covers?.find((c) => c.selected) ||
				relatedBookSource.covers?.[0] ||
				null;
			const relatedBook = {
				...relatedBookSource,
				cover: this.mediaUrlService.resolveUrl(
					selectedCover?.url || null,
					StorageBucket.BOOKS,
				),
				coverMetadata: selectedCover?.metadata || null,
			};

			return {
				relationId: rel.id,
				relationType: rel.relationType,
				isBidirectional: rel.isBidirectional,
				order: rel.order,
				metadata: rel.metadata,
				direction: direction,
				relatedBook,
				createdAt: rel.createdAt,
			};
		});

		// Filter by types
		if (query.types && query.types.length > 0) {
			items = items.filter((item) =>
				query.types?.includes(item.relationType as BookRelationType),
			);
		}

		// Evaluate access for each related book
		const filteredItems: RelatedBookItem[] = [];
		for (const item of items) {
			const access =
				await this.userAccessPolicyService.evaluateAccessForBook({
					userId,
					bookId: item.relatedBook.id,
					bookTagIds: item.relatedBook.tags.map((t) => t.id),
					bookSensitiveContentIds:
						item.relatedBook.sensitiveContent.map((sc) => sc.id),
					bookSensitiveContentWeights:
						item.relatedBook.sensitiveContent.map(
							(sc) => sc.weight,
						),
					baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
				});

			if (access.blocked) {
				continue;
			}

			// Filter by sensitive content weight of the related book
			const hasOversensitiveContent =
				item.relatedBook.sensitiveContent.some(
					(sc) =>
						sc.weight > access.effectiveMaxWeightSensitiveContent,
				);

			if (!hasOversensitiveContent) {
				filteredItems.push(item);
			}
		}

		// Sort items: type (if requested), order (ASC, nulls last), then createdAt (DESC), then id (DESC)
		filteredItems.sort((a, b) => {
			if (query.sortByType) {
				const typeCompare = a.relationType.localeCompare(
					b.relationType,
				);
				if (typeCompare !== 0) {
					return typeCompare;
				}
			}

			const orderA = a.order ?? this.relationshipNullOrderValue;
			const orderB = b.order ?? this.relationshipNullOrderValue;

			if (orderA !== orderB) {
				return orderA - orderB;
			}

			const dateA = a.createdAt.getTime();
			const dateB = b.createdAt.getTime();

			if (dateB !== dateA) {
				return dateB - dateA;
			}

			return b.relationId.localeCompare(a.relationId);
		});

		const limit = query.limit ?? 20;

		if (query.cursor) {
			const decodedCursor =
				decodeCursorPayload<BookRelationshipsCursorPayload>(
					query.cursor,
				);

			if (decodedCursor) {
				const cursorType = decodedCursor.relationType;
				const cursorOrder =
					decodedCursor.order ?? this.relationshipNullOrderValue;
				const cursorCreatedAt = new Date(
					decodedCursor.createdAt,
				).getTime();

				const startIndex = filteredItems.findIndex((item) => {
					if (query.sortByType && cursorType) {
						const typeCompare =
							item.relationType.localeCompare(cursorType);
						if (typeCompare > 0) return true;
						if (typeCompare < 0) return false;
					}

					const itemOrder =
						item.order ?? this.relationshipNullOrderValue;
					const itemCreatedAt = item.createdAt.getTime();

					if (itemOrder > cursorOrder) return true;
					if (itemOrder < cursorOrder) return false;

					if (itemCreatedAt < cursorCreatedAt) return true;
					if (itemCreatedAt > cursorCreatedAt) return false;

					return item.relationId.localeCompare(decodedCursor.id) < 0;
				});

				const pagedItems =
					startIndex === -1 ? [] : filteredItems.slice(startIndex);
				const hasNextPage = pagedItems.length > limit;
				const data = hasNextPage
					? pagedItems.slice(0, limit)
					: pagedItems;

				const lastItem = data[data.length - 1];
				const nextCursor =
					hasNextPage && lastItem
						? encodeCursorPayload({
								...(query.sortByType && {
									relationType: lastItem.relationType,
								}),
								order: lastItem.order,
								createdAt: lastItem.createdAt.toISOString(),
								id: lastItem.relationId,
							})
						: null;

				return new CursorPageDto(data, nextCursor, hasNextPage);
			}
		}

		const offset = query.offset ?? 0;
		const total = filteredItems.length;
		const pagedItems = filteredItems.slice(offset, offset + limit);

		return {
			total,
			limit,
			offset,
			items: pagedItems,
		};
	}

	private normalizePair(
		sourceBookId: string,
		targetBookId: string,
		isBidirectional: boolean,
	): { sourceBookId: string; targetBookId: string } {
		if (!isBidirectional) {
			return { sourceBookId, targetBookId };
		}

		if (sourceBookId.localeCompare(targetBookId) <= 0) {
			return { sourceBookId, targetBookId };
		}

		return {
			sourceBookId: targetBookId,
			targetBookId: sourceBookId,
		};
	}

	private buildMetadata(
		note?: string,
		weight?: number,
	): BookRelationshipMetadata | null {
		const metadata: BookRelationshipMetadata = {};

		if (note !== undefined) {
			metadata.note = note;
		}

		if (weight !== undefined) {
			metadata.weight = weight;
		}

		return Object.keys(metadata).length > 0 ? metadata : null;
	}

	private async ensureBooksExist(
		sourceBookId: string,
		targetBookId: string,
	): Promise<void> {
		const [sourceExists, targetExists] = await Promise.all([
			this.bookRepository.exists(sourceBookId),
			this.bookRepository.exists(targetBookId),
		]);

		if (!sourceExists || !targetExists) {
			throw new NotFoundException(
				'Um ou mais livros informados não existem.',
			);
		}
	}

	private async getRelationshipById(idRelationship: string) {
		const relationship =
			await this.bookRelationshipRepository.findById(idRelationship);

		if (!relationship) {
			throw new NotFoundException('Relacionamento não encontrado.');
		}

		return relationship;
	}

	private ensureRelationshipBelongsToBook(
		relationship: BookRelationship,
		idBook: string,
	) {
		if (
			relationship.sourceBookId !== idBook &&
			relationship.targetBookId !== idBook
		) {
			throw new NotFoundException(
				'Relacionamento não encontrado para o livro informado.',
			);
		}
	}
}
