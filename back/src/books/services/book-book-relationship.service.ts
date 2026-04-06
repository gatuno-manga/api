import {
	BadRequestException,
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminUsersService } from 'src/users/admin-users.service';
import { In, IsNull, Repository } from 'typeorm';
import { BookRelationshipsQueryDto } from '../dto/book-relationships-query.dto';
import { CreateBookRelationshipDto } from '../dto/create-book-relationship.dto';
import { UpdateBookRelationshipDto } from '../dto/update-book-relationship.dto';
import {
	BookRelationship,
	BookRelationshipMetadata,
} from '../entities/book-relationship.entity';
import { Book } from '../entities/book.entity';

export type RelatedBookItem = {
	relationId: string;
	relationType: string;
	isBidirectional: boolean;
	order: number | null;
	metadata: BookRelationshipMetadata | null;
	direction: 'incoming' | 'outgoing';
	relatedBook: Book;
};

@Injectable()
export class BookBookRelationshipService {
	constructor(
		@InjectRepository(BookRelationship)
		private readonly bookRelationshipRepository: Repository<BookRelationship>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly adminUsersService: AdminUsersService,
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

		const existing = await this.bookRelationshipRepository.findOne({
			where: {
				sourceBookId: normalizedPair.sourceBookId,
				targetBookId: normalizedPair.targetBookId,
				relationType: dto.relationType,
				deletedAt: IsNull(),
			},
		});

		if (existing) {
			throw new ConflictException(
				'Já existe uma relação desse tipo entre os livros informados.',
			);
		}

		const entity = this.bookRelationshipRepository.create({
			sourceBookId: normalizedPair.sourceBookId,
			targetBookId: normalizedPair.targetBookId,
			relationType: dto.relationType,
			isBidirectional: dto.isBidirectional ?? false,
			order: dto.order ?? null,
			metadata: this.buildMetadata(dto.note, dto.weight),
		});

		const saved = await this.bookRelationshipRepository.save(entity);
		return this.getRelationshipById(saved.id);
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

		const duplicate = await this.bookRelationshipRepository.findOne({
			where: {
				sourceBookId: normalizedPair.sourceBookId,
				targetBookId: normalizedPair.targetBookId,
				relationType: nextRelationType,
				deletedAt: IsNull(),
			},
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
		return this.getRelationshipById(relationship.id);
	}

	async deleteRelationship(idBook: string, idRelationship: string) {
		const relationship = await this.getRelationshipById(idRelationship);
		this.ensureRelationshipBelongsToBook(relationship, idBook);

		await this.bookRelationshipRepository.softDelete({
			id: idRelationship,
		});
		return { deleted: true, idRelationship };
	}

	async listRelationships(
		idBook: string,
		query: BookRelationshipsQueryDto,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		const bookExists = await this.bookRepository.exists({
			where: { id: idBook, deletedAt: IsNull() },
		});

		if (!bookExists) {
			throw new NotFoundException('Livro não encontrado.');
		}

		const limit = query.limit ?? 20;
		const offset = query.offset ?? 0;

		const qb = this.bookRelationshipRepository
			.createQueryBuilder('relationship')
			.leftJoinAndSelect('relationship.sourceBook', 'sourceBook')
			.leftJoinAndSelect('relationship.targetBook', 'targetBook')
			.where('relationship.deletedAt IS NULL')
			.andWhere(
				'(relationship.sourceBookId = :idBook OR relationship.targetBookId = :idBook)',
				{ idBook },
			)
			.orderBy('relationship.order', 'ASC')
			.addOrderBy('relationship.createdAt', 'DESC')
			.take(limit)
			.skip(offset);

		if (query.types && query.types.length > 0) {
			qb.andWhere('relationship.relationType IN (:...types)', {
				types: query.types,
			});
		}

		const [relationships] = await qb.getManyAndCount();
		const relatedBookIds = Array.from(
			new Set(
				relationships.flatMap((relationship) => [
					relationship.sourceBookId,
					relationship.targetBookId,
				]),
			),
		).filter((bookId) => bookId !== idBook);

		let relatedBooks: Book[] = [];
		if (relatedBookIds.length) {
			relatedBooks = await this.bookRepository.find({
				where: {
					id: In(relatedBookIds),
					deletedAt: IsNull(),
				},
				relations: {
					tags: true,
					sensitiveContent: true,
				},
			});
		}

		const relatedBookById = new Map(
			relatedBooks.map((relatedBook) => [relatedBook.id, relatedBook]),
		);

		const items: RelatedBookItem[] = [];

		for (const relationship of relationships) {
			const isOutgoing = relationship.sourceBookId === idBook;
			const relatedBookId = isOutgoing
				? relationship.targetBookId
				: relationship.sourceBookId;
			const relatedBook = relatedBookById.get(relatedBookId);

			if (!relatedBook) {
				continue;
			}

			const accessResult =
				await this.adminUsersService.evaluateAccessForBook({
					userId,
					bookId: relatedBook.id,
					bookTagIds: (relatedBook.tags || []).map((tag) => tag.id),
					bookSensitiveContentIds: (
						relatedBook.sensitiveContent || []
					).map((sensitiveContent) => sensitiveContent.id),
					baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
				});

			if (accessResult.blocked) {
				continue;
			}

			const relatedBookWeight = (
				relatedBook.sensitiveContent || []
			).reduce(
				(totalWeight, sensitiveContent) =>
					totalWeight + (sensitiveContent.weight || 0),
				0,
			);

			if (
				relatedBookWeight >
				accessResult.effectiveMaxWeightSensitiveContent
			) {
				continue;
			}

			items.push({
				relationId: relationship.id,
				relationType: relationship.relationType,
				isBidirectional: relationship.isBidirectional,
				order: relationship.order,
				metadata: relationship.metadata,
				direction: isOutgoing ? 'outgoing' : 'incoming',
				relatedBook,
			});
		}

		return {
			total: items.length,
			limit,
			offset,
			items,
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
			this.bookRepository.exists({
				where: { id: sourceBookId, deletedAt: IsNull() },
			}),
			this.bookRepository.exists({
				where: { id: targetBookId, deletedAt: IsNull() },
			}),
		]);

		if (!sourceExists || !targetExists) {
			throw new NotFoundException(
				'Um ou mais livros informados não existem.',
			);
		}
	}

	private async getRelationshipById(idRelationship: string) {
		const relationship = await this.bookRelationshipRepository.findOne({
			where: { id: idRelationship, deletedAt: IsNull() },
			relations: {
				sourceBook: true,
				targetBook: true,
			},
		});

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
