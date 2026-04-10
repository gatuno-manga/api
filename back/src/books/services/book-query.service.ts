import { InjectQueue } from '@nestjs/bullmq';
import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import { BookChaptersCursorPageDto } from '../dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from '../dto/book-chapters-cursor-options.dto';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { AppConfigService } from 'src/app-config/app-config.service';
import { CursorPageDto } from 'src/pages/cursor-page.dto';
import {
	decodeCursorPayload,
	encodeCursorPayload,
} from 'src/pages/cursor.utils';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Author } from '../entities/author.entity';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { Page } from '../entities/page.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';
import { Tag } from '../entities/tags.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { SensitiveContentService } from '../sensitive-content/sensitive-content.service';
import { FilterStrategy } from '../strategies';
import { AdminUsersService } from 'src/users/admin-users.service';
import { BookOrderField } from '../enum/book-order-field.enum';

interface RawChapterRow {
	chapter_id: string;
	chapter_title: string;
	chapter_index: number;
	chapter_scrapingStatus: string;
	readCount: string;
}

interface ChapterPageCount {
	chapterId: string;
	total: string;
}

interface ChapterErrorPageCount {
	chapterId: string;
	cnt: string;
}

interface BookListCursorPayload {
	orderBy: BookOrderField;
	order: OrderDirection;
	value: string | number;
	id: string;
}

type BookListItem = Omit<Book, 'covers'> & { cover: string | null };

/**
 * Service responsável por consultas e buscas de livros
 */
@Injectable()
export class BookQueryService {
	private readonly logger = new Logger(BookQueryService.name);
	private readonly publicationCursorNullValue = -1;

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,
		@InjectRepository(Author)
		private readonly authorRepository: Repository<Author>,
		@InjectRepository(SensitiveContent)
		private readonly sensitiveContentRepository: Repository<SensitiveContent>,
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

	/** Cache de curto prazo para getQueueStats (TTL: 30s) */
	private queueStatsCache: { data: unknown; expiresAt: number } | null = null;
	private readonly QUEUE_STATS_TTL_MS = 30_000;

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

		const bookWeight = book.sensitiveContent.reduce(
			(sum, sensitive) => sum + (sensitive.weight || 0),
			0,
		);

		if (bookWeight > result.effectiveMaxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${book.id} exceeds max weight`);
			throw new ForbiddenException(
				`Book with id ${book.id} exceeds max weight`,
			);
		}
	}

	/**
	 * Aplica filtros dinâmicos aos livros
	 */
	async applyBookFilters(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number,
		filterStrategies: FilterStrategy[],
	): Promise<void> {
		await this.sensitiveContentService.filterBooksSensitiveContent(
			queryBuilder,
			options.sensitiveContent,
			maxWeightSensitiveContent,
		);

		for (const strategy of filterStrategies) {
			if (strategy.canApply(options)) {
				await strategy.apply(queryBuilder, options);
			}
		}
	}

	private mapBooksWithCover(books: Book[]): BookListItem[] {
		return books.map((book) => {
			const { covers, ...rest } = book;
			const coverUrl = covers?.[0]?.url || null;

			return {
				...rest,
				cover: coverUrl ? this.urlImage(coverUrl) : null,
			};
		});
	}

	private getOrderExpressionForBooks(orderByField: BookOrderField): string {
		switch (orderByField) {
			case BookOrderField.TITLE:
				return 'book.title';
			case BookOrderField.PUBLICATION:
				return `COALESCE(book.publication, ${this.publicationCursorNullValue})`;
			case BookOrderField.UPDATED_AT:
				return 'book.updatedAt';
			default:
				return 'book.createdAt';
		}
	}

	private getCursorValueForBook(
		book: Book,
		orderByField: BookOrderField,
	): string | number {
		switch (orderByField) {
			case BookOrderField.TITLE:
				return book.title;
			case BookOrderField.PUBLICATION:
				return book.publication ?? this.publicationCursorNullValue;
			case BookOrderField.UPDATED_AT:
				return book.updatedAt.toISOString();
			default:
				return book.createdAt.toISOString();
		}
	}

	private applyBookCursorFilter(
		queryBuilder: SelectQueryBuilder<Book>,
		cursor: string,
		orderByField: BookOrderField,
		orderDirection: OrderDirection,
	): void {
		const decodedCursor =
			decodeCursorPayload<BookListCursorPayload>(cursor);

		if (
			!decodedCursor ||
			decodedCursor.orderBy !== orderByField ||
			decodedCursor.order !== orderDirection ||
			typeof decodedCursor.id !== 'string'
		) {
			return;
		}

		let cursorValue: string | number | Date = decodedCursor.value;
		if (
			orderByField === BookOrderField.CREATED_AT ||
			orderByField === BookOrderField.UPDATED_AT
		) {
			if (typeof decodedCursor.value !== 'string') {
				return;
			}
			const parsedDate = new Date(decodedCursor.value);
			if (Number.isNaN(parsedDate.getTime())) {
				return;
			}
			cursorValue = parsedDate;
		}

		if (orderByField === BookOrderField.PUBLICATION) {
			if (typeof decodedCursor.value !== 'number') {
				return;
			}
			cursorValue = decodedCursor.value;
		}

		if (
			orderByField === BookOrderField.TITLE &&
			typeof decodedCursor.value !== 'string'
		) {
			return;
		}

		const orderExpression = this.getOrderExpressionForBooks(orderByField);
		const comparisonOperator =
			orderDirection === OrderDirection.ASC ? '>' : '<';

		queryBuilder.andWhere(
			`(
				${orderExpression} ${comparisonOperator} :cursorValue
				OR (${orderExpression} = :cursorValue AND book.id > :cursorId)
			)`,
			{
				cursorValue,
				cursorId: decodedCursor.id,
			},
		);
	}

	/**
	 * Busca todos os livros com paginação e filtros
	 */
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

		if (accessContext.blockedAll) {
			if (options.cursor) {
				return new CursorPageDto([], null, false);
			}
			const metadata = new MetadataPageDto();
			metadata.total = 0;
			metadata.page = options.page;
			metadata.lastPage = 0;
			return new PageDto([], metadata);
		}

		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoin('book.authors', 'authors')
			.leftJoinAndSelect(
				'book.covers',
				'covers',
				'covers.selected = :selected',
				{ selected: true },
			)
			.select([
				'book.id',
				'book.title',
				'book.description',
				'book.type',
				'book.autoUpdate',
				'book.createdAt',
				'book.updatedAt',
				'book.publication',
				'sensitiveContent.name',
				'sensitiveContent.weight',
				'covers.id',
				'covers.url',
				'covers.selected',
				'tags.id',
				'tags.name',
			]);

		await this.applyBookFilters(
			queryBuilder,
			options,
			accessContext.effectiveMaxWeightSensitiveContent,
			filterStrategies,
		);

		if (accessContext.denyBookIds.length > 0) {
			queryBuilder.andWhere('book.id NOT IN (:...denyBookIds)', {
				denyBookIds: accessContext.denyBookIds,
			});
		}

		if (accessContext.denyTagIds.length > 0) {
			queryBuilder.andWhere(
				`book.id NOT IN (
					SELECT bt.booksId
					FROM books_tags_tags bt
					WHERE bt.tagsId IN (:...denyTagIds)
				)`,
				{ denyTagIds: accessContext.denyTagIds },
			);
		}

		if (accessContext.denySensitiveContentIds.length > 0) {
			queryBuilder.andWhere(
				`book.id NOT IN (
					SELECT bs.booksId
					FROM books_sensitive_content_sensitive_content bs
					WHERE bs.sensitiveContentId IN (:...denySensitiveContentIds)
				)`,
				{
					denySensitiveContentIds:
						accessContext.denySensitiveContentIds,
				},
			);
		}

		const orderByField = options.orderBy || BookOrderField.CREATED_AT;
		const orderDirection = options.order || OrderDirection.DESC;

		switch (orderByField) {
			case BookOrderField.TITLE:
				queryBuilder
					.orderBy('book.title', orderDirection)
					.addOrderBy('book.id', 'ASC');
				break;
			case BookOrderField.PUBLICATION:
				queryBuilder
					.orderBy(
						`COALESCE(book.publication, ${this.publicationCursorNullValue})`,
						orderDirection,
					)
					.addOrderBy('book.id', 'ASC');
				break;
			case BookOrderField.UPDATED_AT:
				queryBuilder
					.orderBy('book.updatedAt', orderDirection)
					.addOrderBy('book.id', 'ASC');
				break;
			default:
				queryBuilder
					.orderBy('book.createdAt', orderDirection)
					.addOrderBy('book.id', 'ASC');
				break;
		}

		if (options.cursor) {
			this.applyBookCursorFilter(
				queryBuilder,
				options.cursor,
				orderByField,
				orderDirection,
			);

			queryBuilder.take(options.limit + 1);
			const books = await queryBuilder.getMany();
			const hasNextPage = books.length > options.limit;
			const currentPageBooks = hasNextPage
				? books.slice(0, options.limit)
				: books;
			const data = this.mapBooksWithCover(currentPageBooks);
			const lastBook = currentPageBooks[currentPageBooks.length - 1];

			const nextCursor =
				hasNextPage && lastBook
					? encodeCursorPayload({
							orderBy: orderByField,
							order: orderDirection,
							value: this.getCursorValueForBook(
								lastBook,
								orderByField,
							),
							id: lastBook.id,
						})
					: null;

			return new CursorPageDto(data, nextCursor, hasNextPage);
		}

		queryBuilder
			.skip((options.page - 1) * options.limit)
			.take(options.limit);

		const [books, total] = await queryBuilder.getManyAndCount();
		const data = this.mapBooksWithCover(books);

		const metadata = new MetadataPageDto();
		metadata.total = total;
		metadata.page = options.page;
		metadata.lastPage = Math.ceil(total / options.limit);

		return new PageDto(data, metadata);
	}

	/**
	 * Busca um livro aleatório com filtros
	 */
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

		if (accessContext.blockedAll) {
			this.logger.warn('No books found: blocked by global deny policy');
			throw new NotFoundException('No books found matching the filters');
		}

		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoin('book.sensitiveContent', 'sensitiveContent')
			.leftJoin('book.tags', 'tags')
			.leftJoin('book.authors', 'authors')
			.select('book.id');

		await this.applyBookFilters(
			queryBuilder,
			options,
			accessContext.effectiveMaxWeightSensitiveContent,
			filterStrategies,
		);

		if (accessContext.denyBookIds.length > 0) {
			queryBuilder.andWhere('book.id NOT IN (:...denyBookIds)', {
				denyBookIds: accessContext.denyBookIds,
			});
		}

		if (accessContext.denyTagIds.length > 0) {
			queryBuilder.andWhere(
				`book.id NOT IN (
					SELECT bt.booksId
					FROM books_tags_tags bt
					WHERE bt.tagsId IN (:...denyTagIds)
				)`,
				{ denyTagIds: accessContext.denyTagIds },
			);
		}

		if (accessContext.denySensitiveContentIds.length > 0) {
			queryBuilder.andWhere(
				`book.id NOT IN (
					SELECT bs.booksId
					FROM books_sensitive_content_sensitive_content bs
					WHERE bs.sensitiveContentId IN (:...denySensitiveContentIds)
				)`,
				{
					denySensitiveContentIds:
						accessContext.denySensitiveContentIds,
				},
			);
		}

		const count = await queryBuilder.getCount();

		if (count === 0) {
			this.logger.warn('No books found matching the filters');
			throw new NotFoundException('No books found matching the filters');
		}

		const randomOffset = Math.floor(Math.random() * count);
		const book = await queryBuilder.skip(randomOffset).take(1).getOne();

		if (!book) {
			this.logger.warn('No books found matching the filters');
			throw new NotFoundException('No books found matching the filters');
		}

		return { id: book.id };
	}

	/**
	 * Busca um livro por ID
	 */
	async getOne(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.authors', 'authors')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect(
				'book.covers',
				'covers',
				'covers.selected = :selected',
				{ selected: true },
			)
			.loadRelationCountAndMap('book.totalChapters', 'book.chapters')
			.where('book.id = :id', { id })
			.select([
				'book.id',
				'book.title',
				'book.description',
				'book.publication',
				'book.type',
				'book.scrapingStatus',
				'book.autoUpdate',
				'sensitiveContent.id',
				'sensitiveContent.name',
				'sensitiveContent.weight',
				'covers.url',
				'tags.id',
				'tags.name',
				'authors.id',
				'authors.name',
			])
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		const coverUrl = book.covers?.[0]?.url || '';
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { covers, ...rest } = book;

		return {
			...rest,
			cover: this.urlImage(coverUrl),
		};
	}

	/**
	 * Busca capítulos de um livro
	 */
	async getChapters(
		id: string,
		options: BookChaptersCursorOptionsDto,
		userid?: string,
		maxWeightSensitiveContent = 0,
	): Promise<BookChaptersCursorPageDto> {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.where('book.id = :id', { id })
			.select(['book.id', 'sensitiveContent.weight', 'tags.id'])
			.addSelect('sensitiveContent.id')
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userid,
		);

		const pageLimit = options.limit ?? 200;
		const cursorIndex = this.decodeCursor(options.cursor);
		const orderDirection = options.order || OrderDirection.ASC;

		const chaptersQuery = this.chapterRepository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :id', { id })
			.select([
				'chapter.id',
				'chapter.title',
				'chapter.index',
				'chapter.scrapingStatus',
			])
			.orderBy('chapter.index', orderDirection)
			.limit(pageLimit + 1);

		if (cursorIndex !== null) {
			if (orderDirection === OrderDirection.ASC) {
				chaptersQuery.andWhere('chapter.index > :cursorIndex', {
					cursorIndex,
				});
			} else {
				chaptersQuery.andWhere('chapter.index < :cursorIndex', {
					cursorIndex,
				});
			}
		}

		if (!userid) {
			const chapters = await chaptersQuery.getMany();
			return this.createChapterCursorPage(chapters, pageLimit);
		}

		chaptersQuery.addSelect(
			(qb) =>
				qb
					.select('COUNT(cr.id)')
					.from('chapters_read', 'cr')
					.where('cr.chapterId = chapter.id')
					.andWhere('cr.userId = :userid', { userid }),
			'readCount',
		);

		const rawChapters = await chaptersQuery.getRawMany<RawChapterRow>();

		const chapters = rawChapters.map((row) => ({
			id: row.chapter_id,
			title: row.chapter_title,
			index: row.chapter_index,
			scrapingStatus: row.chapter_scrapingStatus as ScrapingStatus,
			read: Number(row.readCount) > 0,
		}));

		return this.createChapterCursorPage(chapters, pageLimit);
	}

	private createChapterCursorPage(
		chapters: Array<{
			id: string;
			title: string;
			index: number;
			scrapingStatus: ScrapingStatus | null;
			read?: boolean;
		}>,
		limit: number,
	): BookChaptersCursorPageDto {
		const hasNextPage = chapters.length > limit;
		const data = hasNextPage ? chapters.slice(0, limit) : chapters;
		const lastItem = data[data.length - 1];

		return new BookChaptersCursorPageDto(
			data,
			hasNextPage && lastItem
				? Buffer.from(String(lastItem.index)).toString('base64')
				: null,
			hasNextPage,
		);
	}

	private decodeCursor(cursor?: string): number | null {
		if (!cursor) {
			return null;
		}

		try {
			const decodedCursor = Buffer.from(cursor, 'base64').toString(
				'utf8',
			);
			const cursorValue = Number(decodedCursor);

			if (Number.isNaN(cursorValue)) {
				return null;
			}

			return cursorValue;
		} catch {
			return null;
		}
	}

	/**
	 * Busca capas de um livro
	 */
	async getCovers(
		id: string,
		maxWeightSensitiveContent = 0,
		userId?: string,
	) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.covers', 'covers')
			.where('book.id = :id', { id })
			.orderBy('covers.index', 'ASC')
			.select([
				'book.id',
				'sensitiveContent.id',
				'sensitiveContent.weight',
				'tags.id',
				'covers.id',
				'covers.url',
				'covers.title',
				'covers.index',
				'covers.selected',
			])
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		return book.covers.map((cover) => ({
			...cover,
			url: this.urlImage(cover.url),
		}));
	}

	/**
	 * Busca informações detalhadas de um livro
	 */
	async getInfos(id: string, maxWeightSensitiveContent = 0, userId?: string) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.authors', 'authors')
			.leftJoinAndSelect('book.covers', 'covers')
			.where('book.id = :id', { id })
			.select([
				'book.id',
				'book.alternativeTitle',
				'book.originalUrl',
				'book.scrapingStatus',
				'book.createdAt',
				'book.updatedAt',
				'sensitiveContent.id',
				'sensitiveContent.weight',
				'tags.id',
				'authors.id',
				'authors.name',
			])
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		await this.ensureUserCanAccessBook(
			book,
			maxWeightSensitiveContent,
			userId,
		);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { sensitiveContent, ...rest } = book;
		return rest;
	}

	/**
	 * Verifica status de um livro
	 */
	async verifyBook(idBook: string) {
		const bookExists = await this.bookRepository.findOne({
			where: { id: idBook },
			select: { id: true },
		});

		if (!bookExists) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		const chapters = await this.chapterRepository
			.createQueryBuilder('ch')
			.where('ch.bookId = :idBook', { idBook })
			.select(['ch.id', 'ch.title', 'ch.scrapingStatus'])
			.getMany();

		if (chapters.length === 0) {
			return {
				numberOfChapters: 0,
				numberOfPages: 0,
				numberOfChaptersWithError: 0,
				pagesErrorCount: 0,
				errorChapters: [],
			};
		}

		const chapterIds = chapters.map((ch) => ch.id);

		const [pageCountRows, errorPageCountRows] = await Promise.all([
			this.pageRepository
				.createQueryBuilder('p')
				.innerJoin('p.chapter', 'ch')
				.where('ch.id IN (:...chapterIds)', { chapterIds })
				.select('ch.id', 'chapterId')
				.addSelect('COUNT(p.id)', 'total')
				.groupBy('ch.id')
				.getRawMany<ChapterPageCount>(),
			this.pageRepository
				.createQueryBuilder('p')
				.innerJoin('p.chapter', 'ch')
				.where('ch.id IN (:...chapterIds)', { chapterIds })
				.andWhere(
					"(p.path IS NULL OR p.path LIKE 'null%' OR p.path LIKE 'undefined%')",
				)
				.select('ch.id', 'chapterId')
				.addSelect('COUNT(p.id)', 'cnt')
				.groupBy('ch.id')
				.getRawMany<ChapterErrorPageCount>(),
		]);

		const pageCountMap = new Map(
			pageCountRows.map((r) => [r.chapterId, Number(r.total)]),
		);
		const errorPageCountMap = new Map(
			errorPageCountRows.map((r) => [r.chapterId, Number(r.cnt)]),
		);

		const numberOfPages = Array.from(pageCountMap.values()).reduce(
			(acc, v) => acc + v,
			0,
		);

		const errorChapters = chapters.filter((ch) => {
			const pageCount = pageCountMap.get(ch.id) ?? 0;
			const errorCount = errorPageCountMap.get(ch.id) ?? 0;
			return (
				ch.scrapingStatus === ScrapingStatus.ERROR ||
				pageCount <= 5 ||
				errorCount > 0
			);
		});

		return {
			numberOfChapters: chapters.length,
			numberOfPages,
			numberOfChaptersWithError: errorChapters.length,
			pagesErrorCount: errorChapters.reduce(
				(acc, ch) => acc + (errorPageCountMap.get(ch.id) ?? 0),
				0,
			),
			errorChapters: errorChapters.map((ch) => ({
				id: ch.id,
				title: ch.title,
				scrapingStatus: ScrapingStatus.ERROR,
				erroPages: errorPageCountMap.get(ch.id) ?? 0,
			})),
		};
	}

	/**
	 * Busca livros em processamento
	 */
	async getProcessBook() {
		const books = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.chapters', 'chapter')
			.leftJoinAndSelect('book.covers', 'covers')
			.select([
				'book.id',
				'book.title',
				'chapter.id',
				'chapter.title',
				'chapter.scrapingStatus',
				'covers.url',
				'covers.selected',
			])
			.getMany();

		let totalChapters = 0;
		let processingChapters = 0;

		const booksWithProcessing = books
			.map((book) => {
				const chapters = (book.chapters || []).filter(
					(ch) => ch.scrapingStatus === ScrapingStatus.PROCESS,
				);
				if (chapters.length === 0) return null;
				totalChapters += chapters.length;
				processingChapters += chapters.length;

				const selectedCover = book.covers?.find((c) => c.selected);
				const coverUrl =
					selectedCover?.url || book.covers?.[0]?.url || null;

				return {
					id: book.id,
					title: book.title,
					cover: coverUrl ? this.urlImage(coverUrl) : null,
					processingChapters: chapters.length,
					totalChapters: book.chapters.length,
				};
			})
			.filter(Boolean);

		return {
			totalChapters,
			processingChapters,
			books: booksWithProcessing,
		};
	}

	/**
	 * Busca overview do dashboard
	 */
	async getDashboardOverview() {
		const [books, chapters, pages, tags, authors, sensitiveContent] =
			await Promise.all([
				this.bookRepository.count(),
				this.chapterRepository.count(),
				this.pageRepository.count(),
				this.tagRepository.count(),
				this.authorRepository.count(),
				this.sensitiveContentRepository.count(),
			]);

		return {
			books,
			chapters,
			pages,
			tags,
			authors,
			sensitiveContent,
		};
	}

	/**
	 * Helper para construir URL de imagem
	 */
	private urlImage(url: string): string {
		const appUrl = this.appConfig.apiUrl;
		return `${appUrl}${url}`;
	}

	async getQueueStats() {
		if (
			this.queueStatsCache &&
			Date.now() < this.queueStatsCache.expiresAt
		) {
			return this.queueStatsCache.data;
		}

		try {
			const [
				bookUpdateCounts,
				bookUpdateActive,
				bookUpdateWaiting,
				bookUpdateDelayed,
				chapterScrapingCounts,
				chapterScrapingActive,
				chapterScrapingWaiting,
				chapterScrapingDelayed,
				coverImageCounts,
				coverImageActive,
				coverImageWaiting,
				coverImageDelayed,
				fixChapterCounts,
				fixChapterActive,
				fixChapterWaiting,
				fixChapterDelayed,
			] = await Promise.all([
				this.bookUpdateQueue.getJobCounts(),
				this.bookUpdateQueue.getActive(),
				this.bookUpdateQueue.getWaiting(),
				this.bookUpdateQueue.getDelayed(),
				this.chapterScrapingQueue.getJobCounts(),
				this.chapterScrapingQueue.getActive(),
				this.chapterScrapingQueue.getWaiting(),
				this.chapterScrapingQueue.getDelayed(),
				this.coverImageQueue.getJobCounts(),
				this.coverImageQueue.getActive(),
				this.coverImageQueue.getWaiting(),
				this.coverImageQueue.getDelayed(),
				this.fixChapterQueue.getJobCounts(),
				this.fixChapterQueue.getActive(),
				this.fixChapterQueue.getWaiting(),
				this.fixChapterQueue.getDelayed(),
			]);

			const bookUpdatePending = [
				...bookUpdateWaiting,
				...bookUpdateDelayed,
			].slice(0, 10);
			const coverImagePending = [
				...coverImageWaiting,
				...coverImageDelayed,
			].slice(0, 10);

			const bookIds = [
				...new Set([
					...bookUpdateActive.map((j) => j.data.bookId),
					...bookUpdatePending.map((j) => j.data.bookId),
					...coverImageActive.map((j) => j.data.bookId),
					...coverImagePending.map((j) => j.data.bookId),
				]),
			].filter(Boolean);

			const books =
				bookIds.length > 0
					? await this.bookRepository.find({
							where: bookIds.map((id) => ({ id })),
							select: { id: true, title: true },
						})
					: [];
			const bookMap = new Map(books.map((b) => [b.id, b.title]));

			const chapterScrapingPending = [
				...chapterScrapingWaiting,
				...chapterScrapingDelayed,
			].slice(0, 10);
			const fixChapterPending = [
				...fixChapterWaiting,
				...fixChapterDelayed,
			].slice(0, 10);

			const chapterIds = [
				...new Set([
					...chapterScrapingActive.map(
						(j) => j.data as unknown as string,
					),
					...chapterScrapingPending.map(
						(j) => j.data as unknown as string,
					),
					...fixChapterActive.map((j) => j.data.chapterId),
					...fixChapterPending.map((j) => j.data.chapterId),
				]),
			].filter(Boolean);

			const chapters =
				chapterIds.length > 0
					? await this.chapterRepository
							.createQueryBuilder('chapter')
							.innerJoinAndSelect('chapter.book', 'book')
							.whereInIds(chapterIds)
							.select([
								'chapter.id',
								'chapter.title',
								'book.id',
								'book.title',
							])
							.getMany()
					: [];
			const chapterMap = new Map(
				chapters.map((c) => [
					c.id,
					{
						title: c.title,
						bookId: c.book?.id ?? null,
						bookTitle: c.book?.title ?? 'Unknown',
					},
				]),
			);

			const pendingMeta = (job: Job) => ({
				delayed: job.delay > 0,
				processAt:
					job.delay > 0 ? new Date(job.timestamp + job.delay) : null,
			});

			const mapBookJob = (
				job: Job<{ bookId: string }>,
				pending = false,
			) => ({
				id: job.id,
				bookId: job.data.bookId,
				bookTitle: bookMap.get(job.data.bookId) ?? 'Unknown',
				timestamp: job.timestamp,
				...(pending && pendingMeta(job)),
			});

			const mapChapterJob = (
				job: Job<string | { chapterId: string }>,
				isDirectString: boolean,
				pending = false,
			) => {
				const chapterId = isDirectString
					? (job.data as string)
					: (job.data as { chapterId: string }).chapterId;
				const info = chapterMap.get(chapterId);
				return {
					id: job.id,
					chapterId,
					chapterTitle: info?.title ?? 'Unknown',
					bookId: info?.bookId ?? null,
					bookTitle: info?.bookTitle ?? 'Unknown',
					timestamp: job.timestamp,
					...(pending && pendingMeta(job)),
				};
			};

			const mapCoverJob = (
				job: Job<QueueCoverProcessorDto>,
				pending = false,
			) => ({
				id: job.id,
				bookId: job.data.bookId,
				bookTitle: bookMap.get(job.data.bookId) ?? 'Unknown',
				urlOrigin: job.data.urlOrigin,
				timestamp: job.timestamp,
				...(pending && pendingMeta(job)),
			});

			const result = {
				queues: [
					{
						name: 'book-update-queue',
						counts: bookUpdateCounts,
						activeJobs: bookUpdateActive.map((j) => mapBookJob(j)),
						pendingJobs: bookUpdatePending.map((j) =>
							mapBookJob(j, true),
						),
					},
					{
						name: 'chapter-scraping',
						counts: chapterScrapingCounts,
						activeJobs: chapterScrapingActive.map((j) =>
							mapChapterJob(j, true),
						),
						pendingJobs: chapterScrapingPending.map((j) =>
							mapChapterJob(j, true, true),
						),
					},
					{
						name: 'cover-image-queue',
						counts: coverImageCounts,
						activeJobs: coverImageActive.map((j) => mapCoverJob(j)),
						pendingJobs: coverImagePending.map((j) =>
							mapCoverJob(j, true),
						),
					},
					{
						name: 'fix-chapter-queue',
						counts: fixChapterCounts,
						activeJobs: fixChapterActive.map((j) =>
							mapChapterJob(j, false),
						),
						pendingJobs: fixChapterPending.map((j) =>
							mapChapterJob(j, false, true),
						),
					},
				],
			};

			this.queueStatsCache = {
				data: result,
				expiresAt: Date.now() + this.QUEUE_STATS_TTL_MS,
			};

			return result;
		} catch (error) {
			this.logger.error('Failed to fetch queue stats', error);
			throw error;
		}
	}
}
