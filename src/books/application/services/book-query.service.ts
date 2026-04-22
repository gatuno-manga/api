import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ForbiddenException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
	BookChaptersCursorPageDto,
	BookChapterCursorItemDto,
} from '../dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from '../dto/book-chapters-cursor-options.dto';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { MetadataPageDto } from 'src/common/pagination/metadata-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Author } from '../../domain/entities/author';
import { Book } from '../../domain/entities/book';
import { Chapter } from '../../domain/entities/chapter';
import { Page } from '../../domain/entities/page';
import { SensitiveContent } from '../../domain/entities/sensitive-content';
import { Tag } from '../../domain/entities/tag';
import { ScrapingStatus } from '../../domain/enums/scrapingStatus.enum';
import { SensitiveContentService } from './sensitive-content.service';
import { FilterStrategy } from '../strategies';
import { AdminUsersService } from 'src/users/application/use-cases/admin-users.service';
import { BookOrderField } from '../../domain/enums/book-order-field.enum';
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

interface RawChapterRow {
	chapter_id: string;
	chapter_title: string;
	chapter_index: number;
	chapter_scrapingStatus: string;
	readCount: string;
}

/**
 * Interface representando o item retornado pelo repositório de capítulos.
 * Pode ser um objeto bruto (quando userId está presente) ou a entidade de domínio.
 */
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
		private readonly appConfig: AppConfigService,
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
			cover: this.toAbsoluteMediaUrl(b.covers?.[0]?.url || null),
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
			cover: this.toAbsoluteMediaUrl(covers?.[0]?.url || null),
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
				cover.url = this.toAbsoluteMediaUrl(cover.url);
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
				cover.url = this.toAbsoluteMediaUrl(cover.url);
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
		return { queues: [] };
	}

	private toAbsoluteMediaUrl(url: string | null): string {
		if (
			!url ||
			url.startsWith('null') ||
			url.startsWith('undefined') ||
			url.startsWith('http')
		) {
			return url || '';
		}

		return `${this.appConfig.apiUrl}${url}`;
	}
}
