import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookEvents } from '@books/domain/constants/events.constant';
import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { Book } from '@books/domain/entities/book';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { BookRelationshipService } from './book-relationship.service';
import { ChapterManagementService } from './chapter-management.service';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '@books/application/ports/book-repository.interface';
import {
	I_UNIT_OF_WORK,
	IUnitOfWork,
} from 'src/common/application/ports/unit-of-work.interface';

/**
 * Service responsável pela criação de livros
 */
@Injectable()
export class BookCreationService {
	private readonly logger = new Logger(BookCreationService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_UNIT_OF_WORK)
		private readonly unitOfWork: IUnitOfWork,
		private readonly bookRelationshipService: BookRelationshipService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly coverImageService: CoverImageService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	/**
	 * Cria um novo livro com todas as suas relações de forma atômica
	 */
	async createBook(dto: CreateBookDto): Promise<Book> {
		const conflictCheck = await this.bookRepository.checkBookTitleConflict(
			dto.title,
			dto.alternativeTitle || [],
		);

		if (conflictCheck.conflict && !dto.ignoreConflict) {
			throw new BadRequestException({
				message: `Já existe um livro com o título "${dto.title}" ou com um dos títulos alternativos. Se deseja cadastrar mesmo assim, defina o campo 'validator' como true.`,
				conflictingBook: conflictCheck.existingBook,
			});
		}

		return this.unitOfWork.runInTransaction(async (uow) => {
			const bookRepo = uow.getBookRepository();
			const chapterRepo = uow.getChapterRepository();
			const tagRepo = uow.getTagRepository();
			const authorRepo = uow.getAuthorRepository();
			const sensitiveRepo = uow.getSensitiveContentRepository();

			const tags =
				dto.tags && dto.tags.length > 0
					? await this.bookRelationshipService.findOrCreateTags(
							dto.tags,
							tagRepo,
						)
					: [];

			const authors =
				dto.authors && dto.authors.length > 0
					? await this.bookRelationshipService.findOrCreateAuthors(
							dto.authors,
							authorRepo,
						)
					: [];

			const sensitiveContent =
				dto.sensitiveContent && dto.sensitiveContent.length > 0
					? await this.bookRelationshipService.findOrCreateSensitiveContent(
							dto.sensitiveContent,
							sensitiveRepo,
						)
					: [];

			const book = new Book();
			Object.assign(book, {
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

			const savedBook = await bookRepo.save(book);

			if (dto.chapters && dto.chapters.length > 0) {
				const createdChapters =
					await this.chapterManagementService.createChaptersFromDto(
						dto.chapters,
						savedBook,
						chapterRepo,
					);
				savedBook.chapters = createdChapters;
			}

			if (dto.cover?.urlImgs && dto.cover.urlImgs.length > 0) {
				// Queue job should only be added after commit, but for now we keep it here
				// or move it outside the transaction block
				await this.coverImageService.addCoverToQueue(
					savedBook.id,
					dto.cover.urlOrigin,
					dto.cover.urlImgs,
				);
			}

			this.eventEmitter.emit(BookEvents.CREATED, savedBook);

			return savedBook;
		});
	}

	/**
	 * Verifica conflitos de título de livro
	 */
	async checkBookTitleConflict(
		title: string,
		alternativeTitles: string[] = [],
	) {
		return this.bookRepository.checkBookTitleConflict(
			title,
			alternativeTitles,
		);
	}
}
