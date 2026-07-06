import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { CreateChapterDto } from '@books/application/dto/create-chapter.dto';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import { BookEvents } from '@books/domain/constants/events.constant';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { Book } from '@books/domain/entities/book';
import { BookDescription } from '@books/domain/entities/book-description';
import { Chapter } from '@books/domain/entities/chapter';
import { Cover } from '@books/domain/entities/cover';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientKafka } from '@nestjs/microservices';
import { WebsiteService } from '@websites/application/services/website.service';
import {
	IUnitOfWork,
	I_UNIT_OF_WORK,
} from 'src/common/application/ports/unit-of-work.interface';
import { v7 as uuidv7 } from 'uuid';
import { BookRelationshipService } from './book-relationship.service';
import { ChapterManagementService } from './chapter-management.service';

@Injectable()
export class BookCreationService implements OnModuleInit {
	private readonly logger = new Logger(BookCreationService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_UNIT_OF_WORK)
		private readonly unitOfWork: IUnitOfWork,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly websiteService: WebsiteService,
		private readonly bookRelationshipService: BookRelationshipService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly coverImageService: CoverImageService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		// Conecta em background para não bloquear o bootstrap da API
		this.scraperClient.connect().catch((error) => {
			this.logger.error(
				`[BookCreationService] Falha ao conectar ao Scraper Kafka em background: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
	}

	async autoCreateBook(url: string): Promise<{ jobId: string }> {
		const host = new URL(url).hostname;
		const websiteConfig = await this.websiteService.getByUrl(host);

		if (!websiteConfig) {
			throw new BadRequestException(
				`Não há configuração de scraping para o site: ${host}`,
			);
		}

		const jobId = uuidv7();

		const payload = {
			jobId,
			targetUrl: url,
			websiteId: websiteConfig.id,
			newBookExtractScript: websiteConfig.newBookExtractScript,
			uploadTarget: {
				bucket: StorageBucket.PROCESSING,
			},
		};

		this.scraperClient
			.emit('scraping.new-book.requested', payload)
			.subscribe({
				next: () => {
					this.logger.log(
						`New book request successfully emitted to Kafka: ${jobId}`,
					);
				},
				error: (err) => {
					this.logger.error(
						`Failed to emit new book request to Kafka: ${err instanceof Error ? err.message : String(err)}`,
					);
				},
			});

		return { jobId };
	}

	async createBook(dto: CreateBookDto): Promise<Book> {
		// Consolidate alternative titles from all possible fields
		const consolidatedAltTitles: AlternativeTitle[] = [];

		// 1. Process new field 'alternativeTitles' (objects or strings)
		if (dto.alternativeTitles?.length) {
			for (const alt of dto.alternativeTitles) {
				const isString = typeof alt === 'string';
				const title = isString ? (alt as string) : alt.title;
				const languageCode = isString ? null : alt.languageCode;
				const rank = isString ? 0 : (alt.rank ?? 0);

				if (title) {
					consolidatedAltTitles.push(
						new AlternativeTitle(title, languageCode || null, rank),
					);
				}
			}
		}

		// 2. Process legacy field 'alternativeTitle' (strings)
		if (dto.alternativeTitle?.length) {
			for (const title of dto.alternativeTitle) {
				if (
					title &&
					!consolidatedAltTitles.some((t) => t.title === title)
				) {
					consolidatedAltTitles.push(
						new AlternativeTitle(title, null, 0),
					);
				}
			}
		}

		// 3. Consolidate localized descriptions
		const consolidatedDescriptions: BookDescription[] = [];
		if (dto.localizedDescriptions?.length) {
			for (const item of dto.localizedDescriptions) {
				consolidatedDescriptions.push(
					new BookDescription(
						item.description,
						item.languageCode,
						item.rank ?? 0,
					),
				);
			}
		}

		if (dto.description) {
			const lang = dto.originalLanguageCode || 'pt-BR';
			if (
				!consolidatedDescriptions.some(
					(d) =>
						d.languageCode === lang &&
						d.description === dto.description,
				)
			) {
				consolidatedDescriptions.push(
					new BookDescription(dto.description, lang, 0),
				);
			}
		}

		const alternativeTitlesStrings = consolidatedAltTitles.map(
			(alt) => alt.title,
		);

		const conflictCheck = await this.bookRepository.checkBookTitleConflict(
			dto.title,
			alternativeTitlesStrings,
		);

		if (conflictCheck.conflict && !dto.ignoreConflict) {
			throw new BadRequestException({
				message: `Já existe um livro com o título "${dto.title}" ou com um dos títulos alternativos. Se deseja cadastrar mesmo assim, defina o campo 'validator' as true.`,
				conflictingBook: conflictCheck.existingBook,
			});
		}

		return this.unitOfWork.runInTransaction(async (uow) => {
			const bookRepo = uow.getBookRepository();
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
				alternativeTitles: consolidatedAltTitles,
				localizedDescriptions: consolidatedDescriptions,
				searchTerms: dto.searchTerms,
				description: dto.description,
				publication: dto.publication,
				type: dto.type,
				originalLanguageCode: dto.originalLanguageCode,
				allowedScrapingLanguages: dto.allowedScrapingLanguages ?? [],
				sensitiveContent,
				tags,
				authors,
				chapters: [],
			});

			const savedBook = await bookRepo.save(book);

			if (dto.chapters && dto.chapters.length > 0) {
				const chapterRepo = uow.getChapterRepository();
				const chaptersToCreate = dto.chapters.map((chDto) => {
					const chapter = new Chapter();
					Object.assign(chapter, {
						title: chDto.title,
						originalUrl: chDto.url,
						index: chDto.index,
						isFinal: chDto.isFinal ?? false,
						specificSelector: chDto.specificSelector,
						book: savedBook,
						scrapingStatus: ScrapingStatus.PROCESS,
					});
					return chapter;
				});

				const savedChapters =
					await chapterRepo.saveAll(chaptersToCreate);

				if (savedChapters) {
					savedBook.chapters = savedChapters.map((c) => {
						const { book: _, ...chapterData } = c;
						return chapterData as Chapter;
					});
				}
			}

			if (dto.cover?.urlImgs && dto.cover.urlImgs.length > 0) {
				const coverRepo = uow.getCoverRepository();
				const covers = dto.cover.urlImgs.map((img, index) => {
					const cover = new Cover();
					Object.assign(cover, {
						url: img.url, // Fast-track: usa a URL original imediatamente
						originalUrl: img.url,
						title: img.title || `Capa ${index + 1}`,
						index: index,
						selected: index === 0,
						book: savedBook,
						scrapingStatus: ScrapingStatus.PROCESS,
					});
					return cover;
				});

				const savedCovers = await coverRepo.saveAll(covers);
				// Remove referência circular para evitar erros de serialização (JSON.stringify)
				savedBook.covers = savedCovers.map((c) => {
					const { book: _, ...coverData } = c;
					return coverData as Cover;
				});

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

	async createChaptersFromDto(
		bookId: string,
		chaptersDto: CreateChapterDto[],
	): Promise<Chapter[]> {
		return this.chapterManagementService.createChaptersFromDto(
			bookId,
			chaptersDto,
		);
	}

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
