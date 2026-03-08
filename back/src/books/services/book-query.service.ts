import { InjectQueue } from '@nestjs/bullmq';
import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { AppConfigService } from 'src/app-config/app-config.service';
import { MetadataPageDto } from 'src/pages/metadata-page.dto';
import { PageDto } from 'src/pages/page.dto';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Author } from '../entities/author.entity';
import { Book } from '../entities/book.entity';
import { ChapterRead } from '../entities/chapter-read.entity';
import { Chapter } from '../entities/chapter.entity';
import { Page } from '../entities/page.entity';
import { SensitiveContent } from '../entities/sensitive-content.entity';
import { Tag } from '../entities/tags.entity';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { SensitiveContentService } from '../sensitive-content/sensitive-content.service';
import { FilterStrategy } from '../strategies';

/**
 * Service responsável por consultas e buscas de livros
 */
@Injectable()
export class BookQueryService {
	private readonly logger = new Logger(BookQueryService.name);

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
	) {}

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

	/**
	 * Busca todos os livros com paginação e filtros
	 */
	async getAllBooks(
		options: BookPageOptionsDto,
		maxWeightSensitiveContent: number,
		filterStrategies: FilterStrategy[],
	): Promise<PageDto<Omit<Book, 'covers'> & { cover: string | null }>> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.authors', 'authors')
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
			maxWeightSensitiveContent,
			filterStrategies,
		);

		const orderByField = options.orderBy || 'createdAt';
		const orderDirection = options.order || 'DESC';

		switch (orderByField) {
			case 'title':
				queryBuilder.orderBy('book.title', orderDirection);
				break;
			case 'publication':
				queryBuilder.orderBy('book.publication', orderDirection);
				break;
			case 'updatedAt':
				queryBuilder.orderBy('book.updatedAt', orderDirection);
				break;
			default:
				queryBuilder.orderBy('book.createdAt', orderDirection);
				break;
		}

		queryBuilder
			.skip((options.page - 1) * options.limit)
			.take(options.limit);

		const [books, total] = await queryBuilder.getManyAndCount();
		const data = books.map((book) => {
			const { covers, ...rest } = book;
			const coverUrl = covers?.[0]?.url || null;

			return {
				...rest,
				cover: coverUrl ? this.urlImage(coverUrl) : null,
			};
		});

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
		filterStrategies: FilterStrategy[],
	): Promise<{ id: string }> {
		const queryBuilder = this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.tags', 'tags')
			.leftJoinAndSelect('book.authors', 'authors')
			.select(['book.id']);

		await this.applyBookFilters(
			queryBuilder,
			options,
			maxWeightSensitiveContent,
			filterStrategies,
		);

		queryBuilder.orderBy('RAND()').limit(1);

		const book = await queryBuilder.getOne();

		if (!book) {
			this.logger.warn('No books found matching the filters');
			throw new NotFoundException('No books found matching the filters');
		}

		return { id: book.id };
	}

	/**
	 * Busca um livro por ID
	 */
	async getOne(id: string, maxWeightSensitiveContent = 0) {
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

		const maxWeight = book.sensitiveContent.reduce(
			(sum, sc) => sum + (sc.weight || 0),
			0,
		);
		if (maxWeight > maxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${id} exceeds max weight`);
			throw new ForbiddenException(
				`Book with id ${id} exceeds max weight`,
			);
		}

		const coverUrl = book.covers?.[0]?.url || '';
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
		userid?: string,
		maxWeightSensitiveContent = 0,
	) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.where('book.id = :id', { id })
			.select(['book.id', 'sensitiveContent.weight'])
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		const maxWeight = book.sensitiveContent.reduce(
			(sum, sc) => sum + (sc.weight || 0),
			0,
		);
		if (maxWeight > maxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${id} exceeds max weight`);
			throw new ForbiddenException(
				`Book with id ${id} exceeds max weight`,
			);
		}

		const chaptersQuery = this.chapterRepository
			.createQueryBuilder('chapter')
			.where('chapter.bookId = :id', { id })
			.select([
				'chapter.id',
				'chapter.title',
				'chapter.index',
				'chapter.scrapingStatus',
			])
			.orderBy('chapter.index', 'ASC');

		const chapters = await chaptersQuery.getMany();

		if (!userid) return chapters;

		let readChapterIds = new Set<string>();
		if (userid) {
			const readChapters = await this.bookRepository.manager
				.getRepository(ChapterRead)
				.createQueryBuilder('cr')
				.innerJoin('cr.chapter', 'chapter')
				.innerJoin('chapter.book', 'book')
				.where('cr.user.id = :userid', { userid })
				.andWhere('book.id = :bookId', { bookId: id })
				.select('chapter.id')
				.getRawMany();

			readChapterIds = new Set(readChapters.map((r) => r.chapter_id));
		}

		const chaptersWithReadStatus = chapters.map((chapter) => ({
			...chapter,
			read: readChapterIds.has(chapter.id),
		}));

		return chaptersWithReadStatus;
	}

	/**
	 * Busca capas de um livro
	 */
	async getCovers(id: string, maxWeightSensitiveContent = 0) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
			.leftJoinAndSelect('book.covers', 'covers')
			.where('book.id = :id', { id })
			.orderBy('covers.index', 'ASC')
			.select([
				'book.id',
				'sensitiveContent.weight',
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

		const maxWeight = book.sensitiveContent.reduce(
			(sum, sc) => sum + (sc.weight || 0),
			0,
		);
		if (maxWeight > maxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${id} exceeds max weight`);
			throw new ForbiddenException(
				`Book with id ${id} exceeds max weight`,
			);
		}

		return book.covers.map((cover) => ({
			...cover,
			url: this.urlImage(cover.url),
		}));
	}

	/**
	 * Busca informações detalhadas de um livro
	 */
	async getInfos(id: string, maxWeightSensitiveContent = 0) {
		const book = await this.bookRepository
			.createQueryBuilder('book')
			.leftJoinAndSelect('book.sensitiveContent', 'sensitiveContent')
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
				'sensitiveContent.weight',
				'authors.id',
				'authors.name',
			])
			.getOne();

		if (!book) {
			this.logger.warn(`Book with id ${id} not found`);
			throw new NotFoundException(`Book with id ${id} not found`);
		}

		const maxWeight = book.sensitiveContent.reduce(
			(sum, sc) => sum + (sc.weight || 0),
			0,
		);
		if (maxWeight > maxWeightSensitiveContent) {
			this.logger.warn(`Book with id ${id} exceeds max weight`);
			throw new ForbiddenException(
				`Book with id ${id} exceeds max weight`,
			);
		}

		const { sensitiveContent, ...rest } = book;
		return rest;
	}

	/**
	 * Verifica status de um livro
	 */
	async verifyBook(idBook: string) {
		const book = await this.bookRepository.findOne({
			where: { id: idBook },
			relations: ['chapters', 'chapters.pages'],
		});

		if (!book) {
			this.logger.warn(`Book with id ${idBook} not found`);
			throw new NotFoundException(`Book with id ${idBook} not found`);
		}

		const errorChapters: Chapter[] = [];
		for (const chapter of book.chapters) {
			const hasNullPathPage = chapter.pages.some(
				(page) =>
					page.path === null ||
					page.path.startsWith('null') ||
					page.path.startsWith('undefined'),
			);

			if (
				chapter.scrapingStatus === ScrapingStatus.ERROR ||
				chapter.pages.length <= 5 ||
				hasNullPathPage
			) {
				chapter.scrapingStatus = ScrapingStatus.ERROR;
				errorChapters.push(chapter);
			}
		}

		return {
			numberOfChapters: book.chapters.length,
			numberOfPages: book.chapters.reduce(
				(acc, chapter) => acc + chapter.pages.length,
				0,
			),
			numberOfChaptersWithError: errorChapters.length,
			pagesErrorCount: errorChapters.reduce(
				(acc, chapter) =>
					acc +
					chapter.pages.filter(
						(page) =>
							page.path === null ||
							page.path.startsWith('null') ||
							page.path.startsWith('undefined'),
					).length,
				0,
			),
			errorChapters: errorChapters.map((chapter) => ({
				id: chapter.id,
				title: chapter.title,
				scrapingStatus: chapter.scrapingStatus,
				erroPages: chapter.pages.filter(
					(page) =>
						page.path === null ||
						page.path.startsWith('null') ||
						page.path.startsWith('undefined'),
				).length,
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

			const pendingMeta = (job: {
				delay: number;
				timestamp: number;
			}) => ({
				delayed: job.delay > 0,
				processAt:
					job.delay > 0 ? new Date(job.timestamp + job.delay) : null,
			});

			const mapBookJob = (job, pending = false) => ({
				id: job.id,
				bookId: job.data.bookId,
				bookTitle: bookMap.get(job.data.bookId) ?? 'Unknown',
				timestamp: job.timestamp,
				...(pending && pendingMeta(job)),
			});

			const mapChapterJob = (
				job,
				isDirectString: boolean,
				pending = false,
			) => {
				const chapterId = isDirectString
					? (job.data as unknown as string)
					: job.data.chapterId;
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

			const mapCoverJob = (job, pending = false) => ({
				id: job.id,
				bookId: job.data.bookId,
				bookTitle: bookMap.get(job.data.bookId) ?? 'Unknown',
				urlOrigin: job.data.urlOrigin,
				timestamp: job.timestamp,
				...(pending && pendingMeta(job)),
			});

			return {
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
		} catch (error) {
			this.logger.error('Failed to fetch queue stats', error);
			throw error;
		}
	}
}
