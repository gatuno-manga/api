import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { normalizeUrl } from 'src/common/utils/url.utils';
import { ScrapingService } from '../../../scraping/application/services/scraping.service';
import { Book } from '../../domain/entities/book';
import { Chapter } from '../../domain/entities/chapter';
import { Cover } from '../../domain/entities/cover';
import { ScrapingStatus } from '../../domain/enums/scrapingStatus.enum';
import { CoverImageService } from '../../infrastructure/jobs/cover-image.service';
import {
	I_BOOK_REPOSITORY,
	IBookRepository,
} from '../ports/book-repository.interface';
import {
	I_CHAPTER_REPOSITORY,
	IChapterRepository,
} from '../ports/chapter-repository.interface';
import {
	I_COVER_REPOSITORY,
	ICoverRepository,
} from '../ports/cover-repository.interface';

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
export class BookContentUpdateService {
	private readonly logger = new Logger(BookContentUpdateService.name);

	constructor(
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject(I_CHAPTER_REPOSITORY)
		private readonly chapterRepository: IChapterRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		private readonly scrapingService: ScrapingService,
		private readonly eventEmitter: EventEmitter2,
		private readonly coverImageService: CoverImageService,
	) {}

	/**
	 * Executa a atualização de conteúdo de um livro
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

		if (!book.originalUrl || book.originalUrl.length === 0) {
			this.logger.warn(`Book ${book.title} has no original URL`);
			return { newChapters: 0, newCovers: 0 };
		}

		let totalNewCovers = 0;
		let totalNewChapters = 0;
		const allCreatedChapters: Chapter[] = [];

		for (const bookUrl of book.originalUrl) {
			try {
				this.logger.debug(`Scraping book info from: ${bookUrl}`);

				const bookInfo =
					await this.scrapingService.scrapeBookInfo(bookUrl);

				const newCovers = await this.syncCovers(
					book,
					bookInfo.covers || [],
					bookUrl,
				);
				totalNewCovers += newCovers;

				if (bookInfo.chapters.length === 0) {
					this.logger.debug(`No chapters found from URL: ${bookUrl}`);
					continue;
				}

				const createdChapters = await this.syncChapters(
					book,
					bookInfo.chapters,
					allCreatedChapters,
				);
				allCreatedChapters.push(...createdChapters);
				totalNewChapters += createdChapters.length;
			} catch (error) {
				this.logger.warn(
					`Error scraping from URL ${bookUrl}: ${error.message}`,
				);
			}
		}

		if (allCreatedChapters.length > 0) {
			this.emitUpdateEvents(book, allCreatedChapters, totalNewCovers);
		}

		return { newChapters: totalNewChapters, newCovers: totalNewCovers };
	}

	/**
	 * Sincroniza capítulos: identifica novos capítulos e os cria no banco
	 */
	private async syncChapters(
		book: Book,
		scrapedChapters: ScrapedChapter[],
		alreadyCreatedChapters: Chapter[],
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

		return createdChapters;
	}

	/**
	 * Busca todos os índices de capítulos existentes
	 */
	private async getExistingChapterIndexes(
		bookId: string,
		additionalChapters: Chapter[],
	): Promise<Set<number>> {
		// Simplified for build - in real implementation this should use a specific repo method
		const chapters = await this.chapterRepository.findByBookId(bookId);

		return new Set([
			...chapters.map((ch) => Number.parseFloat(ch.index.toString())),
			...additionalChapters.map((ch) => ch.index),
		]);
	}

	/**
	 * Determina o próximo índice disponível para um capítulo
	 */
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
	private async syncCovers(
		book: Book,
		scrapedCovers: ScrapedCover[],
		refererUrl: string,
	): Promise<number> {
		if (scrapedCovers.length === 0) {
			return 0;
		}

		const existingHashes = new Set(
			book.covers.filter((c) => c.imageHash).map((c) => c.imageHash),
		);

		let newCoversCount = 0;

		for (const scrapedCover of scrapedCovers) {
			try {
				const imageHash =
					await this.coverImageService.calculateImageHash(
						scrapedCover.url,
						refererUrl,
					);

				if (existingHashes.has(imageHash)) {
					this.logger.debug(
						`Cover already exists (hash match): ${scrapedCover.url}`,
					);
					continue;
				}

				const cover = new Cover();
				Object.assign(cover, {
					url: normalizeUrl(scrapedCover.url),
					originalUrl: normalizeUrl(scrapedCover.url),
					title:
						scrapedCover.title || `Capa ${book.covers.length + 1}`,
					index: book.covers.length,
					imageHash: imageHash,
					selected: book.covers.length === 0,
					book: book,
				});

				const savedCover = await this.coverRepository.save(cover);
				book.covers.push(savedCover);
				existingHashes.add(imageHash);
				newCoversCount++;

				await this.coverImageService.addCoverToQueue(
					book.id,
					refererUrl,
					[{ url: scrapedCover.url, title: savedCover.title }],
				);

				this.logger.debug(
					`Added new cover for book ${book.title}: ${scrapedCover.title || scrapedCover.url}`,
				);
			} catch (error) {
				this.logger.warn(
					`Failed to process cover ${scrapedCover.url}: ${error.message}`,
				);
			}
		}

		if (newCoversCount > 0) {
			this.logger.log(
				`Added ${newCoversCount} new covers to book: ${book.title}`,
			);
		}

		return newCoversCount;
	}

	/**
	 * Emite eventos de atualização
	 */
	private emitUpdateEvents(
		book: Book,
		newChapters: Chapter[],
		newCoversCount: number,
	): void {
		this.eventEmitter.emit('chapters.updated', newChapters);

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
			`Added ${newChapters.length} new chapters to book: ${book.title}`,
		);
	}
}
