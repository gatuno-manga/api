import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { CreateBookDto } from '../dto/create-book.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CoverImageService } from '../jobs/cover-image.service';
import { BookRelationshipService } from './book-relationship.service';
import { ChapterManagementService } from './chapter-management.service';

/**
 * Service responsável pela criação de livros
 */
@Injectable()
export class BookCreationService {
	private readonly logger = new Logger(BookCreationService.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly bookRelationshipService: BookRelationshipService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly coverImageService: CoverImageService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Cria um novo livro com todas as suas relações
	 */
	async createBook(dto: CreateBookDto): Promise<Book> {
		const conflictCheck = await this.checkBookTitleConflict(
			dto.title,
			dto.alternativeTitle || [],
		);

		if (conflictCheck.conflict && !dto.validator) {
			throw new BadRequestException({
				message:
					`Já existe um livro com o título "${dto.title}" ou com um dos títulos alternativos. ` +
					`Se deseja cadastrar mesmo assim, defina o campo 'validator' como true.`,
				conflictingBook: conflictCheck.existingBook,
			});
		}

		return await this.bookRepository.manager.transaction(
			async (manager) => {
				const tags =
					dto.tags && dto.tags.length > 0
						? await this.bookRelationshipService.findOrCreateTags(
								dto.tags,
							)
						: [];
				const authors =
					dto.authors && dto.authors.length > 0
						? await this.bookRelationshipService.findOrCreateAuthors(
								dto.authors,
							)
						: [];
				const sensitiveContent =
					dto.sensitiveContent && dto.sensitiveContent.length > 0
						? await this.bookRelationshipService.findOrCreateSensitiveContent(
								dto.sensitiveContent,
							)
						: [];

				const book = manager.create(Book, {
					title: dto.title,
					originalUrl: dto.originalUrl,
					alternativeTitle: dto.alternativeTitle,
					description: dto.description,
					publication: dto.publication,
					type: dto.type,
					sensitiveContent,
					tags,
					authors,
					chapters: [],
				});

				await manager.save(book);

				if (dto.chapters && dto.chapters.length > 0) {
					const chapterRepo = manager.getRepository(Chapter);
					const chapters =
						await this.chapterManagementService.createChaptersFromDto(
							dto.chapters,
							book,
							chapterRepo,
						);
					book.chapters = chapters;
				}

				if (
					dto.cover &&
					dto.cover.urlImgs &&
					dto.cover.urlImgs.length > 0
				) {
					await this.coverImageService.addCoverToQueue(
						book.id,
						dto.cover.urlOrigin,
						dto.cover.urlImgs,
					);
				}

				const savedBook = await manager.save(book);
				this.eventEmitter.emit('book.created', savedBook);

				return savedBook;
			},
		);
	}

	/**
	 * Verifica conflitos de título de livro
	 */
	async checkBookTitleConflict(
		title: string,
		alternativeTitles: string[] = [],
	): Promise<{
		conflict: boolean;
		existingBook?: {
			id: string;
			title: string;
			alternativeTitle?: string[];
		};
		conflictingBooks?: Array<{
			id: string;
			title: string;
			alternativeTitle?: string[];
		}>;
	}> {
		const queryBuilder = this.bookRepository.createQueryBuilder('book');

		const allTitles = [title, ...alternativeTitles];

		for (let i = 0; i < allTitles.length; i++) {
			const titleToCheck = allTitles[i];
			if (i === 0) {
				queryBuilder.where(`book.title = :title${i}`, {
					[`title${i}`]: titleToCheck,
				});
			} else {
				queryBuilder.orWhere(`book.title = :title${i}`, {
					[`title${i}`]: titleToCheck,
				});
			}

			queryBuilder.orWhere(
				`JSON_CONTAINS(book.alternativeTitle, :jsonTitle${i})`,
				{
					[`jsonTitle${i}`]: JSON.stringify(titleToCheck),
				},
			);
		}

		queryBuilder.select(['book.id', 'book.title', 'book.alternativeTitle']);

		const conflictingBooks = await queryBuilder.getMany();

		if (conflictingBooks.length > 0) {
			const formattedBooks = conflictingBooks.map((book) => ({
				id: book.id,
				title: book.title,
				alternativeTitle: book.alternativeTitle,
			}));

			return {
				conflict: true,
				existingBook: formattedBooks[0],
				conflictingBooks: formattedBooks,
			};
		}

		return { conflict: false };
	}
}
