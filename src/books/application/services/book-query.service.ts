import { MEILI_CLIENT } from '@/infrastructure/meilisearch/meilisearch.constants';
import { MeilisearchFilterBuilder } from '@books/application/builders/meilisearch-filter.builder';
import { BookChaptersCursorOptionsDto } from '@books/application/dto/book-chapters-cursor-options.dto';
import {
	BookChapterCursorItemDto,
	BookChaptersCursorPageDto,
} from '@books/application/dto/book-chapters-cursor-page.dto';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { QueueCoverProcessorDto } from '@books/application/dto/queue-cover-processor.dto';
import {
	IAuthorRepository,
	I_AUTHOR_REPOSITORY,
} from '@books/application/ports/author-repository.interface';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	IChapterRepository,
	I_CHAPTER_REPOSITORY,
} from '@books/application/ports/chapter-repository.interface';
import {
	IPageRepository,
	I_PAGE_REPOSITORY,
} from '@books/application/ports/page-repository.interface';
import {
	ISensitiveContentRepository,
	I_SENSITIVE_CONTENT_REPOSITORY,
} from '@books/application/ports/sensitive-content-repository.interface';
import {
	ITagRepository,
	I_TAG_REPOSITORY,
} from '@books/application/ports/tag-repository.interface';
import { FilterStrategy } from '@books/application/strategies';
import { resolveLocalizedField } from '@books/application/utils/localization.utils';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { AuthorBiography } from '@books/domain/entities/author-biography';
import { Book } from '@books/domain/entities/book';
import { BookDescription } from '@books/domain/entities/book-description';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { InjectQueue } from '@nestjs/bullmq';
import {
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { Meilisearch } from 'meilisearch';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { MetadataPageDto } from 'src/common/pagination/metadata-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { MediaUrlService } from 'src/common/services/media-url.service';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';
import { SensitiveContentService } from './sensitive-content.service';

interface RawChapterItem {
	// Campos da entidade
	id?: string;
	title?: string;
	index?: number | string;
	scrapingStatus?: ScrapingStatus;

	// Campos do getRawMany
	chapter_id?: string;
	chapter_title?: string;
	chapter_index?: string | number;
	chapter_scrapingStatus?: ScrapingStatus;
	readCount?: string | number;
}

type BookListItem = Omit<Book, 'covers'> & {
	cover: string | null;
	coverMetadata: ImageMetadata | null;
};

@Injectable()
export class BookQueryService {
	private readonly logger = new Logger(BookQueryService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_PAGE_REPOSITORY)
		private readonly pageRepository: IPageRepository,
		@Inject(I_TAG_REPOSITORY)
		private readonly tagRepository: ITagRepository,
		@Inject(I_AUTHOR_REPOSITORY)
		private readonly authorRepository: IAuthorRepository,
		@Inject(I_SENSITIVE_CONTENT_REPOSITORY)
		private readonly sensitiveContentRepository: ISensitiveContentRepository,
		readonly _sensitiveContentService: SensitiveContentService,
		private readonly mediaUrlService: MediaUrlService,
		@InjectQueue('book-update-queue')
		private readonly bookUpdateQueue: Queue<{ bookId: string }>,
		@InjectQueue('chapter-scraping')
		private readonly chapterScrapingQueue: Queue<string>,
		@InjectQueue('cover-image-queue')
		private readonly coverImageQueue: Queue<QueueCoverProcessorDto>,
		@InjectQueue('fix-chapter-queue')
		private readonly fixChapterQueue: Queue<{ chapterId: string }>,
		private readonly userAccessPolicyService: UserAccessPolicyService,
		@Inject(MEILI_CLIENT)
		private readonly meiliClient: Meilisearch,
	) {}

	private async ensureUserCanAccessBook(
		book: Pick<Book, 'id' | 'sensitiveContent' | 'tags'>,
		maxWeightSensitiveContent: number,
		userId?: string,
	) {
		const result = await this.userAccessPolicyService.evaluateAccessForBook(
			{
				userId,
				bookId: book.id,
				bookTagIds: (book.tags || []).map((tag) => tag.id),
				bookSensitiveContentIds: (book.sensitiveContent || []).map(
					(sensitiveContent) => sensitiveContent.id,
				),
				bookSensitiveContentWeights: (book.sensitiveContent || []).map(
					(sensitiveContent) => sensitiveContent.weight,
				),
				baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
			},
		);

		if (result.blocked) {
			throw new ForbiddenException(
				`Book with id ${book.id} is blocked by access policy`,
			);
		}
	}

	private mapBookLocalizations(book: Book, targetLang?: string): Book {
		const lang = targetLang || 'pt-BR';

		// 1. Resolver Título
		const bestTitle = resolveLocalizedField(
			book.alternativeTitles,
			lang,
			book.originalLanguageCode,
			'pt-BR',
			(item: AlternativeTitle) => item.title,
		);
		if (bestTitle) {
			book.title = bestTitle.title;
		}

		// 2. Resolver Descrição
		const bestDesc = resolveLocalizedField(
			book.localizedDescriptions,
			lang,
			book.originalLanguageCode,
			'pt-BR',
			(item: BookDescription) => item.description,
		);
		if (bestDesc) {
			book.description = bestDesc.description;
		}

		// 3. Resolver Biografia dos Autores
		if (book.authors) {
			for (const author of book.authors) {
				const bestBio = resolveLocalizedField(
					author.localizedBiographies,
					lang,
					null,
					'pt-BR',
					(item: AuthorBiography) => item.biography,
				);
				if (bestBio) {
					author.biography = bestBio.biography;
				}
			}
		}

		return book;
	}

	async getAllBooks(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number,
		userId: string | undefined,
		filterStrategies: FilterStrategy[],
		targetLang?: string,
	): Promise<PageDto<BookListItem> | CursorPageDto<BookListItem>> {
		const accessContext =
			await this.userAccessPolicyService.evaluateListAccessContext({
				userId,
				baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
			});

		// CAMINHO 1: Busca via Meilisearch (quando há termo de pesquisa)
		if (options.search?.trim()) {
			try {
				const filter = MeilisearchFilterBuilder.build(
					options,
					accessContext,
				);
				const limit = options.limit || 20;
				const offset = (options.page - 1) * limit;

				// Determina ordenação
				const sort: string[] = [];
				if (options.orderBy) {
					sort.push(
						`${options.orderBy}:${(options.order || 'desc').toLowerCase()}`,
					);
				}

				const searchResult = await this.meiliClient
					.index('books')
					.search(options.search, {
						limit,
						offset,
						filter,
						sort: sort.length > 0 ? sort : undefined,
						attributesToRetrieve: ['id'],
					});

				const ids = searchResult.hits.map((hit) => hit.id as string);
				const total = searchResult.estimatedTotalHits || 0;

				const books =
					await this.bookRepository.findByIdsPreservingOrder(ids);

				const data = books.map((b) => {
					const mappedBook = this.mapBookLocalizations(
						b,
						targetLang || options.lang,
					);
					const selectedCover = mappedBook.covers?.[0] || null;
					return {
						...mappedBook,
						cover: this.mediaUrlService.resolveUrl(
							selectedCover?.url || null,
							StorageBucket.BOOKS,
						),
						coverMetadata: selectedCover?.metadata || null,
					} as BookListItem;
				});

				const metadata = new MetadataPageDto();
				metadata.total = total;
				metadata.page = options.page;
				metadata.lastPage = Math.ceil(total / limit);

				return new PageDto(data, metadata);
			} catch (error) {
				this.logger.error(
					`Meilisearch query failed, falling back to MySQL: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// CAMINHO 2: Navegação via MySQL (Catálogo ou Fallback)
		const [books, total] = await this.bookRepository.findWithFilters(
			options,
			accessContext,
			filterStrategies,
		);
		const data = books.map((b) => {
			const mappedBook = this.mapBookLocalizations(
				b,
				targetLang || options.lang,
			);
			const selectedCover = mappedBook.covers?.[0] || null;
			return {
				...mappedBook,
				cover: this.mediaUrlService.resolveUrl(
					selectedCover?.url || null,
					StorageBucket.BOOKS,
				),
				coverMetadata: selectedCover?.metadata || null,
			};
		});

		if (options.cursor) {
			return new CursorPageDto(
				data as unknown as BookListItem[],
				null,
				false,
			);
		}

		const metadata = new MetadataPageDto();
		metadata.total = total;
		metadata.page = options.page;
		metadata.lastPage = Math.ceil(total / options.limit);

		return new PageDto(data as unknown as BookListItem[], metadata);
	}

	async getRandomBook(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number,
		userId: string | undefined,
		filterStrategies: FilterStrategy[],
		_targetLang?: string,
	): Promise<{ id: string }> {
		const accessContext =
			await this.userAccessPolicyService.evaluateListAccessContext({
				userId,
				baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
			});

		const book = await this.bookRepository.findRandom(
			options,
			accessContext,
			filterStrategies,
		);
		if (!book) throw new NotFoundException('No books found');
		return { id: book.id };
	}

	async getOne(
		id: string,
		maxWeightSensitiveContent = 0,
		userId?: string,
		forceMaster = false,
		targetLang?: string,
	) {
		const book = await this.bookRepository.findByIdWithDetails(
			id,
			forceMaster ? 'force_master' : undefined,
		);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		const mappedBook = this.mapBookLocalizations(book, targetLang);

		const { covers, ...rest } = mappedBook;
		const selectedCover = covers?.[0] || null;

		return {
			...rest,
			cover: this.mediaUrlService.resolveUrl(
				selectedCover?.url || null,
				StorageBucket.BOOKS,
			),
			coverMetadata: selectedCover?.metadata || null,
		};
	}

	async getChapters(
		id: string,
		options: BookChaptersCursorOptionsDto,
		userid?: string,
		maxWeightSensitiveContent = 0,
	): Promise<BookChaptersCursorPageDto> {
		const book = await this.bookRepository.findById(id, [
			'sensitiveContent',
			'tags',
		]);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userid,
		);

		let cursorIndex: number | null = null;
		if (options.cursor) {
			try {
				const decoded = Buffer.from(options.cursor, 'base64').toString(
					'utf-8',
				);
				cursorIndex = Number(decoded);
				if (Number.isNaN(cursorIndex)) cursorIndex = null;
			} catch (_e) {
				cursorIndex = null;
			}
		}

		const rawChapters =
			(await this.chapterRepository.findChaptersByBookIdWithCursor(
				id,
				{
					limit: options.limit,
					order: options.order,
					cursorIndex,
				},
				userid,
			)) as RawChapterItem[];

		const limit = options.limit || 200;
		const hasNextPage = rawChapters.length > limit;
		const data = hasNextPage ? rawChapters.slice(0, limit) : rawChapters;

		const mappedData: BookChapterCursorItemDto[] = data.map((item) => {
			const isRaw = !!userid;
			return {
				id: (isRaw ? item.chapter_id : item.id) as string,
				title: (isRaw ? item.chapter_title : item.title) as string,
				index: isRaw ? Number(item.chapter_index) : Number(item.index),
				scrapingStatus:
					(isRaw
						? item.chapter_scrapingStatus
						: item.scrapingStatus) ?? null,
				read: isRaw ? Number(item.readCount) > 0 : undefined,
			};
		});

		let nextCursor: string | null = null;
		if (hasNextPage && mappedData.length > 0) {
			const lastItem = mappedData[mappedData.length - 1];
			nextCursor = Buffer.from(lastItem.index.toString()).toString(
				'base64',
			);
		}

		return new BookChaptersCursorPageDto(
			mappedData,
			nextCursor,
			hasNextPage,
		);
	}

	async getCovers(
		id: string,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		const book = await this.bookRepository.findById(id, [
			'sensitiveContent',
			'tags',
			'covers',
		]);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		if (book.covers) {
			book.covers.sort((a, b) => a.index - b.index);
			for (const cover of book.covers) {
				cover.url = this.mediaUrlService.resolveUrl(
					cover.url,
					StorageBucket.BOOKS,
				);
			}
		}

		return book.covers;
	}

	async getInfos(
		id: string,
		maxWeightSensitiveContent = 0,
		userId?: string,
		targetLang?: string,
	) {
		const book = await this.bookRepository.findById(id, [
			'sensitiveContent',
			'tags',
			'authors',
			'covers',
			'localizedDescriptions',
			'alternativeTitles',
			'authors.localizedBiographies',
		]);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		const mappedBook = this.mapBookLocalizations(book, targetLang);

		if (mappedBook.covers) {
			mappedBook.covers.sort((a, b) => a.index - b.index);
			for (const cover of mappedBook.covers) {
				cover.url = this.mediaUrlService.resolveUrl(
					cover.url,
					StorageBucket.BOOKS,
				);
			}
		}

		return mappedBook;
	}

	async verifyBook(idBook: string) {
		const exists = await this.bookRepository.exists(idBook);
		if (!exists) throw new NotFoundException('Book not found');

		const chapters =
			await this.chapterRepository.findChaptersWithError(idBook);
		return { numberOfChapters: chapters.length, errorChapters: [] };
	}

	async getProcessBook() {
		const books = await this.bookRepository.findAllInProcess();
		return { books, totalChapters: 0, processingChapters: 0 };
	}

	async getDashboardOverview() {
		const [books, chapters, pages, tags, _authors, _sensitiveContent] =
			await Promise.all([
				this.bookRepository.count(),
				this.chapterRepository.count(),
				this.pageRepository.count(),
				this.tagRepository.count({}),
				this.authorRepository.count
					? this.authorRepository.count({})
					: Promise.resolve(0), // Stub
				this.sensitiveContentRepository.count
					? this.sensitiveContentRepository.count({})
					: Promise.resolve(0), // Stub
			]);

		return {
			books,
			chapters,
			pages,
			tags,
			authors: 0,
			sensitiveContent: 0,
		};
	}

	async getQueueStats() {
		const getStats = async (queue: Queue) => {
			const [counts, jobs] = await Promise.all([
				queue.getJobCounts(),
				queue.getJobs(['active', 'waiting', 'delayed'], 0, 10, true),
			]);

			const jobsWithState = await Promise.all(
				(jobs as Job<{ bookId?: string; chapterId?: string }>[]).map(
					async (job) => ({
						job,
						state: await job.getState(),
					}),
				),
			);

			const mapJob = (j: {
				job: Job<{ bookId?: string; chapterId?: string }>;
			}) => ({
				id: j.job.id,
				bookId: j.job.data?.bookId || null,
				chapterId: j.job.data?.chapterId || null,
			});

			return {
				name: queue.name,
				counts: {
					waiting: counts.waiting,
					active: counts.active,
					completed: counts.completed,
					failed: counts.failed,
					delayed: counts.delayed,
				},
				activeJobs: jobsWithState
					.filter((j) => j.state === 'active')
					.map(mapJob),
				pendingJobs: jobsWithState
					.filter(
						(j) =>
							j.state === 'waiting' ||
							j.state === 'prioritized' ||
							j.state === 'delayed',
					)
					.map(mapJob),
			};
		};

		const queues = await Promise.all([
			getStats(this.bookUpdateQueue),
			getStats(this.chapterScrapingQueue),
			getStats(this.coverImageQueue),
			getStats(this.fixChapterQueue),
		]);

		return { queues };
	}
}
