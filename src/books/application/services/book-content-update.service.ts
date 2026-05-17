import { RedisService } from '@/infrastructure/redis/redis.service';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import {
	IChapterRepository,
	I_CHAPTER_REPOSITORY,
} from '@books/application/ports/chapter-repository.interface';
import {
	ICoverRepository,
	I_COVER_REPOSITORY,
} from '@books/application/ports/cover-repository.interface';
import { Book } from '@books/domain/entities/book';
import { Chapter } from '@books/domain/entities/chapter';
import { Cover } from '@books/domain/entities/cover';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientKafka } from '@nestjs/microservices';
import { WebsiteService } from '@websites/application/services/website.service';
import { normalizeUrl } from 'src/common/utils/url.utils';
import { v7 as uuidv7 } from 'uuid';

interface ScrapedChapter {
	title: string;
	url: string;
	index?: number;
	isFinal?: boolean;
}

interface ScrapedCover {
	url: string;
	title?: string;
}

interface BookContentUpdateResult {
	newChapters: number;
	newCovers: number;
}

/**
 * Service responsável pela lógica de negócio de atualização de conteúdo de livros
 * (novos capítulos e capas detectados via scraping)
 */
@Injectable()
export class BookContentUpdateService implements OnModuleInit {
	private readonly logger = new Logger(BookContentUpdateService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly websiteService: WebsiteService,
		private readonly eventEmitter: EventEmitter2,
		private readonly coverImageService: CoverImageService,
		private readonly redisService: RedisService,
	) {}

	async onModuleInit() {
		await this.scraperClient.connect();
	}

	/**
	 * Executa a atualização de conteúdo de um livro via scraping direto
	 * @deprecated Use requestUpdateViaScraper para o novo fluxo com microserviço Go
	 */
	async performUpdate(bookId: string): Promise<BookContentUpdateResult> {
		this.logger.debug(`Processing book content update for: ${bookId}`);

		const book = await this.bookRepository.findById(bookId, [
			'chapters',
			'covers',
		]);

		if (!book) {
			this.logger.warn(`Book ${bookId} not found`);
			throw new Error(`Book ${bookId} not found`);
		}

		return { newChapters: 0, newCovers: 0 };
	}

	/**
	 * Dispara a solicitação de scraping para o microserviço em Go via Kafka
	 */
	async requestUpdateViaScraper(
		bookId: string,
	): Promise<{ dispatched: boolean; urlsProcessed: number }> {
		this.logger.log(
			`Requesting update via scraper microservice: ${bookId}`,
		);

		const book = await this.bookRepository.findById(bookId, []);
		if (!book) {
			throw new Error(`Book ${bookId} not found`);
		}

		if (!book.originalUrl || book.originalUrl.length === 0) {
			this.logger.warn(`Book ${book.title} has no original URL`);
			return { dispatched: false, urlsProcessed: 0 };
		}

		// Adicionar lock distribuído para evitar múltiplas solicitações simultâneas
		const redis = this.redisService.getClient();
		const lockKey = `lock:scraping:book:${bookId}`;
		const isLocked = await redis.set(lockKey, 'true', 'EX', 300, 'NX');

		if (!isLocked) {
			this.logger.warn(
				`Scraping already in progress for book ${bookId} (locked)`,
			);
			return { dispatched: false, urlsProcessed: 0 };
		}

		let urlsProcessed = 0;
		for (const bookUrl of book.originalUrl) {
			try {
				const host = new URL(bookUrl).hostname;
				const websiteConfig = await this.websiteService.getByUrl(host);

				if (!websiteConfig) {
					this.logger.warn(
						`Não há configuração de scraping para o site: ${host}`,
					);
					continue;
				}

				const jobId = uuidv7();
				const payload = {
					jobId,
					bookId: book.id,
					targetUrl: bookUrl,
					websiteConfig: {
						name: host,
						cloudflareBypass: websiteConfig.useFlareSolverr,
						preScript: websiteConfig.preScript,
						posScript: websiteConfig.posScript,
						useNetworkInterception:
							websiteConfig.useNetworkInterception,
						useScreenshotMode: websiteConfig.useScreenshotMode,
						cookies: websiteConfig.cookies,
						localStorage: websiteConfig.localStorage,
						sessionStorage: websiteConfig.sessionStorage,
						reloadAfterStorageInjection:
							websiteConfig.reloadAfterStorageInjection,
						enableAdaptiveTimeouts:
							websiteConfig.enableAdaptiveTimeouts,
						timeoutMultipliers: websiteConfig.timeoutMultipliers,
						proxyUrl: websiteConfig.proxyUrl,
						blacklistTerms: websiteConfig.blacklistTerms,
						whitelistTerms: websiteConfig.whitelistTerms,
						selectors: {
							chapterListSelector:
								websiteConfig.chapterListSelector,
							bookInfoExtractScript:
								websiteConfig.bookInfoExtractScript,
							newBookExtractScript:
								websiteConfig.newBookExtractScript,
						},
						headers: {
							Referer: host,
						},
					},
					uploadTarget: {
						bucket: 'processing',
						pathPrefix: `${jobId.slice(-2)}/${jobId}`,
					},
				};

				this.scraperClient.emit(
					'scraping.update-book.requested',
					payload,
				);
				urlsProcessed++;
			} catch (error) {
				this.logger.warn(
					`Error requesting scrape from URL ${bookUrl}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (urlsProcessed === 0) {
			await redis.del(lockKey);
		}

		return { dispatched: urlsProcessed > 0, urlsProcessed };
	}

	/**
	 * Sincroniza capítulos: identifica novos capítulos e os cria no banco
	 */
	public async syncChapters(
		book: Book,
		scrapedChapters: ScrapedChapter[],
		alreadyCreatedChapters: Chapter[] = [],
	): Promise<Chapter[]> {
		const existingUrls = new Set([
			...book.chapters.map((ch) => normalizeUrl(ch.originalUrl)),
			...alreadyCreatedChapters.map((ch) => normalizeUrl(ch.originalUrl)),
		]);

		const newChapters = scrapedChapters.filter(
			(ch) => !existingUrls.has(normalizeUrl(ch.url)),
		);

		if (newChapters.length === 0) {
			this.logger.debug('No new chapters found');
			return [];
		}

		this.logger.log(`Found ${newChapters.length} new chapters`);

		const existingIndexes = await this.getExistingChapterIndexes(
			book.id,
			alreadyCreatedChapters,
		);

		const createdChapters: Chapter[] = [];
		for (const scraped of newChapters) {
			const nextIndex = this.determineNextChapterIndex(
				scraped,
				existingIndexes,
			);

			const chapter = this.chapterRepository.create({
				title: scraped.title,
				originalUrl: normalizeUrl(scraped.url),
				index: nextIndex,
				isFinal: scraped.isFinal ?? false,
				book: book,
				scrapingStatus: ScrapingStatus.PROCESS,
			});

			const saved = await this.chapterRepository.save(chapter);
			createdChapters.push(saved);
			existingIndexes.add(nextIndex);
		}

		if (createdChapters.length > 0) {
			this.emitUpdateEvents(book, createdChapters, 0);
		}

		return createdChapters;
	}

	private async getExistingChapterIndexes(
		bookId: string,
		additionalChapters: Chapter[],
	): Promise<Set<number>> {
		const chapters = await this.chapterRepository.findByBookId(bookId);

		return new Set([
			...chapters.map((ch) => Number.parseFloat(ch.index.toString())),
			...additionalChapters.map((ch) => ch.index),
		]);
	}

	private determineNextChapterIndex(
		scrapedChapter: ScrapedChapter,
		existingIndexes: Set<number>,
	): number {
		if (
			typeof scrapedChapter.index === 'number' &&
			!Number.isNaN(scrapedChapter.index)
		) {
			return scrapedChapter.index;
		}

		let index = 1;
		while (existingIndexes.has(index)) {
			index++;
		}
		return index;
	}

	/**
	 * Sincroniza capas: identifica novas capas por hash e as cria
	 */
	public async syncCovers(
		book: Book,
		scrapedCovers: ScrapedCover[],
		refererUrl: string,
	): Promise<number> {
		if (scrapedCovers.length === 0) {
			return 0;
		}

		const existingUrls = new Set(
			book.covers
				.filter((c) => c.originalUrl)
				.map((c) => normalizeUrl(c.originalUrl as string)),
		);

		let newCoversCount = 0;

		for (const scrapedCover of scrapedCovers) {
			try {
				const normalizedUrl = normalizeUrl(scrapedCover.url);
				if (existingUrls.has(normalizedUrl)) {
					this.logger.debug(
						`Cover already exists (URL match): ${scrapedCover.url}`,
					);
					continue;
				}

				const cover = new Cover();
				Object.assign(cover, {
					url: normalizedUrl,
					originalUrl: normalizedUrl,
					title:
						scrapedCover.title || `Capa ${book.covers.length + 1}`,
					index: book.covers.length,
					selected: book.covers.length === 0,
					book: book,
					scrapingStatus: ScrapingStatus.PROCESS,
				});

				const savedCover = await this.coverRepository.save(cover);
				book.covers.push(savedCover);
				existingUrls.add(normalizedUrl);
				newCoversCount++;

				await this.coverImageService.addCoverToQueue(
					book.id,
					refererUrl,
					[{ url: scrapedCover.url, title: savedCover.title }],
				);

				this.logger.debug(
					`Added new cover for book ${book.title}: ${scrapedCover.title || scrapedCover.url}`,
				);
			} catch (error: unknown) {
				this.logger.warn(
					`Failed to process cover ${scrapedCover.url}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (newCoversCount > 0) {
			this.logger.log(
				`Added ${newCoversCount} new covers to book: ${book.title}`,
			);
			this.emitUpdateEvents(book, [], newCoversCount);
		}

		return newCoversCount;
	}

	private emitUpdateEvents(
		book: Book,
		newChapters: Chapter[],
		newCoversCount: number,
	): void {
		if (newChapters.length > 0) {
			this.eventEmitter.emit('chapters.updated', newChapters);
		}

		this.eventEmitter.emit('book.new-chapters', {
			bookId: book.id,
			newChaptersCount: newChapters.length,
			chapters: newChapters.map((ch) => ({
				id: ch.id,
				title: ch.title,
				index: ch.index,
				isFinal: ch.isFinal,
			})),
			newCoversCount: newCoversCount,
		});

		this.logger.log(
			`Added ${newChapters.length} new chapters and ${newCoversCount} covers to book: ${book.title}`,
		);
	}

	async addScrapedChapters(
		bookId: string,
		scrapedChapters: ScrapedChapter[],
		scrapedCovers: string[],
	): Promise<void> {
		const book = await this.bookRepository.findById(bookId, [
			'chapters',
			'covers',
		]);
		if (!book) {
			throw new Error(`Book ${bookId} not found`);
		}

		await this.syncChapters(book, scrapedChapters);

		const covers: ScrapedCover[] = scrapedCovers.map((url) => ({ url }));
		await this.syncCovers(book, covers, book.originalUrl?.[0] || '');
	}
}
