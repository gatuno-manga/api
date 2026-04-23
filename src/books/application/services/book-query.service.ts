import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { StorageBucket } from 'src/common/enum/storage-bucket.enum';
import { MediaUrlService } from 'src/common/services/media-url.service';
import {
	BookChaptersCursorPageDto,
	BookChapterCursorItemDto,
} from '../dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from '../dto/book-chapters-cursor-options.dto';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { MetadataPageDto } from 'src/common/pagination/metadata-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../../domain/entities/book';
import { ScrapingStatus } from '../../domain/enums/scrapingStatus.enum';
import { SensitiveContentService } from './sensitive-content.service';
import { FilterStrategy } from '../strategies';
import { AdminUsersService } from 'src/users/application/use-cases/admin-users.service';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';
import {
	I_CHAPTER_REPOSITORY,
	IChapterRepository,
} from '../ports/chapter-repository.interface';
import {
	I_PAGE_REPOSITORY,
	IPageRepository,
} from '../ports/page-repository.interface';
import {
	I_TAG_REPOSITORY,
	ITagRepository,
} from '../ports/tag-repository.interface';
import {
	I_AUTHOR_REPOSITORY,
	IAuthorRepository,
} from '../ports/author-repository.interface';
import {
	I_SENSITIVE_CONTENT_REPOSITORY,
	ISensitiveContentRepository,
} from '../ports/sensitive-content-repository.interface';

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

type BookListItem = Omit<Book, 'covers'> & { cover: string | null };

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
		private readonly sensitiveContentService: SensitiveContentService,
		private readonly mediaUrlService: MediaUrlService,
		@InjectQueue('book-update-queue')
		private readonly bookUpdateQueue: Queue<{ bookId: string }>,
		@InjectQueue('chapter-scraping')
		private readonly chapterScrapingQueue: Queue<string>,
		@InjectQueue('cover-image-queue')
		private readonly coverImageQueue: Queue<QueueCoverProcessorDto>,
		@InjectQueue('fix-chapter-queue')
		private readonly fixChapterQueue: Queue<{ chapterId: string }>,
		private readonly adminUsersService: AdminUsersService,
	) {}

	private async ensureUserCanAccessBook(
		book: Pick<Book, 'id' | 'sensitiveContent' | 'tags'>,
		maxWeightSensitiveContent: number,
		userId?: string,
	) {
		const result = await this.adminUsersService.evaluateAccessForBook({
			userId,
			bookId: book.id,
			bookTagIds: (book.tags || []).map((tag) => tag.id),
			bookSensitiveContentIds: (book.sensitiveContent || []).map(
				(sensitiveContent) => sensitiveContent.id,
			),
			baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
		});

		if (result.blocked) {
			throw new ForbiddenException(
				`Book with id ${book.id} is blocked by access policy`,
			);
		}
	}

	async getAllBooks(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number,
		userId: string | undefined,
		filterStrategies: FilterStrategy[],
	): Promise<PageDto<BookListItem> | CursorPageDto<BookListItem>> {
		const accessContext =
			await this.adminUsersService.evaluateListAccessContext({
				userId,
				baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
			});

		const [books, total] = await this.bookRepository.findWithFilters(
			options,
			accessContext,
			filterStrategies,
		);
		const data = books.map((b) => ({
			...b,
			cover: this.mediaUrlService.resolveUrl(
				b.covers?.[0]?.url || null,
				StorageBucket.BOOKS,
			),
		}));

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
	): Promise<{ id: string }> {
		const accessContext =
			await this.adminUsersService.evaluateListAccessContext({
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

	async getOne(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		const book = await this.bookRepository.findByIdWithDetails(id);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		const { covers, ...rest } = book;
		return {
			...rest,
			cover: this.mediaUrlService.resolveUrl(
				covers?.[0]?.url || null,
				StorageBucket.BOOKS,
			),
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
			} catch (e) {
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
			for (const cover of book.covers) {
				cover.url = this.mediaUrlService.resolveUrl(
					cover.url,
					StorageBucket.BOOKS,
				);
			}
		}

		return book.covers;
	}

	async getInfos(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		const book = await this.bookRepository.findById(id, [
			'sensitiveContent',
			'tags',
			'authors',
			'covers',
		]);
		if (!book) throw new NotFoundException('Book not found');

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		if (book.covers) {
			for (const cover of book.covers) {
				cover.url = this.mediaUrlService.resolveUrl(
					cover.url,
					StorageBucket.BOOKS,
				);
			}
		}

		return book;
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
		const [books, chapters, pages, tags, authors, sensitiveContent] =
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
				jobs.map(async (job) => ({
					job,
					state: await job.getState(),
				})),
			);

			const mapJob = (j: { job: Job }) => ({
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
