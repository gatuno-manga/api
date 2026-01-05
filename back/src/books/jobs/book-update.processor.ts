import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { Cover } from '../entitys/cover.entity';
import { ScrapingService } from 'src/scraping/scraping.service';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { CoverImageService } from './cover-image.service';
import { normalizeUrl } from 'src/common/utils/url.utils';

const QUEUE_NAME = 'book-update-queue';

interface BookUpdateJobData {
	bookId: string;
}

interface ScrapedCover {
	url: string;
	title?: string;
}

interface BookUpdateResult {
	newChapters: number;
	newCovers: number;
}

@Processor(QUEUE_NAME)
export class BookUpdateProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(BookUpdateProcessor.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		private readonly scrapingService: ScrapingService,
		private readonly configService: AppConfigService,
		private readonly eventEmitter: EventEmitter2,
		private readonly coverImageService: CoverImageService,
	) {
		super();
	}

	async onModuleInit() {
		// Usa concorrência baixa para não sobrecarregar
		this.worker.concurrency =
			this.configService.queueConcurrency?.bookUpdate ?? 2;

		// Recalcula hashes de capas existentes que não têm hash
		await this.recalculateMissingCoverHashes();
	}

	/**
	 * Recalcula o hash das capas existentes que ainda não têm imageHash preenchido.
	 * Isso é necessário para capas que foram cadastradas antes da implementação do sistema de deduplicação.
	 */
	private async recalculateMissingCoverHashes(): Promise<void> {
		const coversWithoutHash = await this.coverRepository.find({
			where: { imageHash: IsNull() },
			relations: ['book'],
		});

		if (coversWithoutHash.length === 0) {
			this.logger.debug('No covers without hash found');
			return;
		}

		this.logger.log(
			`Found ${coversWithoutHash.length} covers without hash. Recalculating...`,
		);

		let successCount = 0;
		let errorCount = 0;

		for (const cover of coversWithoutHash) {
			try {
				// Use first original URL as referer if available
				const refererUrl = cover.book?.originalUrl?.[0];
				const imageHash = await this.calculateImageHash(
					cover.url,
					refererUrl,
				);
				cover.imageHash = imageHash;
				await this.coverRepository.save(cover);
				successCount++;
			} catch (error) {
				this.logger.warn(
					`Failed to calculate hash for cover ${cover.id} (${cover.url}): ${error.message}`,
				);
				errorCount++;
			}
		}

		this.logger.log(
			`Cover hash recalculation complete: ${successCount} success, ${errorCount} errors`,
		);
	}

	@OnWorkerEvent('active')
	async onActive(job: Job<BookUpdateJobData>) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.started', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				timestamp: Date.now(),
			});
			this.logger.debug(`Update started for book: ${book.title}`);
		}
	}

	@OnWorkerEvent('completed')
	async onCompleted(
		job: Job<BookUpdateJobData>,
		result: BookUpdateResult,
	) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.completed', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				newChapters: result.newChapters,
				newCovers: result.newCovers,
				timestamp: Date.now(),
			});
			this.logger.debug(
				`Update completed for book: ${book.title} (${result.newChapters} new chapters, ${result.newCovers} new covers)`,
			);
		}
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<BookUpdateJobData>, error: Error) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.failed', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				error: error.message,
				timestamp: Date.now(),
			});
			this.logger.error(`Update failed for book: ${book.title}`, error.stack);
		}
	}

	async process(job: Job<BookUpdateJobData>): Promise<BookUpdateResult> {
		const { bookId } = job.data;
		this.logger.debug(`Processing book update for: ${bookId}`);

		const book = await this.bookRepository.findOne({
			where: { id: bookId },
			relations: ['chapters', 'covers'],
		});

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

		// Itera sobre todas as URLs originais do livro
		for (const bookUrl of book.originalUrl) {
			try {
				this.logger.debug(`Scraping book info from: ${bookUrl}`);

				// Faz scraping das informações do livro (capas e capítulos)
				const bookInfo =
					await this.scrapingService.scrapeBookInfo(bookUrl);

				// Processa novas capas (com deduplicação por hash)
				const newCovers = await this.processNewCovers(
					book,
					bookInfo.covers || [],
					bookUrl,
				);
				totalNewCovers += newCovers;

				if (bookInfo.chapters.length === 0) {
					this.logger.debug(`No chapters found from URL: ${bookUrl}`);
					continue;
				}

				// Encontra capítulos novos comparando URLs normalizadas (considera capítulos já existentes + criados nesta iteração)
				const existingUrls = new Set([
					...book.chapters.map((ch) => normalizeUrl(ch.originalUrl)),
					...allCreatedChapters.map((ch) => normalizeUrl(ch.originalUrl)),
				]);
				const newChapters = bookInfo.chapters.filter(
					(ch) => !existingUrls.has(normalizeUrl(ch.url)),
				);

				if (newChapters.length === 0) {
					this.logger.debug(`No new chapters from URL: ${bookUrl}`);
					continue;
				}

				this.logger.log(
					`Found ${newChapters.length} new chapters from URL: ${bookUrl}`,
				);

				// Calcula o próximo índice baseado em TODOS os capítulos (incluindo soft-deleted)
				// para evitar conflito de constraint unique
				const maxIndexResult = await this.chapterRepository
					.createQueryBuilder('chapter')
					.withDeleted() // Inclui soft-deleted para evitar conflito de constraint
					.select('MAX(chapter.index)', 'maxIndex')
					.where('chapter.bookId = :bookId', { bookId: book.id })
					.getRawOne();
				const dbMaxIndex = parseFloat(maxIndexResult?.maxIndex) || 0;

				// Considera também capítulos criados nesta iteração
				const createdIndexes = allCreatedChapters
					.map((ch) => ch.index)
					.filter((idx) => typeof idx === 'number' && !isNaN(idx));
				const maxCreatedIndex =
					createdIndexes.length > 0 ? Math.max(...createdIndexes) : 0;
				const maxExistingIndex = Math.max(dbMaxIndex, maxCreatedIndex);

				// Cria os novos capítulos
				for (let i = 0; i < newChapters.length; i++) {
					const scraped = newChapters[i];
					const scrapedIndex =
						typeof scraped.index === 'number' && !isNaN(scraped.index)
							? scraped.index
							: null;
					const chapter = this.chapterRepository.create({
						title: scraped.title,
						originalUrl: normalizeUrl(scraped.url),
						index: scrapedIndex ?? maxExistingIndex + i + 1,
						isFinal: scraped.isFinal ?? false,
						book: book,
						scrapingStatus: ScrapingStatus.PROCESS,
					});
					const saved = await this.chapterRepository.save(chapter);
					allCreatedChapters.push(saved);
				}

				totalNewChapters += newChapters.length;
			} catch (error) {
				this.logger.warn(
					`Error scraping from URL ${bookUrl}: ${error.message}`,
				);
				// Continua para a próxima URL em caso de erro
			}
		}

		// Emite eventos apenas se houver novos capítulos
		if (allCreatedChapters.length > 0) {
			// Emite evento para processar os novos capítulos
			this.eventEmitter.emit('chapters.updated', allCreatedChapters);

			// Emite evento de novos capítulos encontrados
			this.eventEmitter.emit('book.new-chapters', {
				bookId: book.id,
				newChaptersCount: allCreatedChapters.length,
				chapters: allCreatedChapters.map((ch) => ({
					id: ch.id,
					title: ch.title,
					index: ch.index,
					isFinal: ch.isFinal,
				})),
				newCoversCount: totalNewCovers,
			});

			this.logger.log(
				`Added ${allCreatedChapters.length} new chapters to book: ${book.title}`,
			);
		}

		return { newChapters: totalNewChapters, newCovers: totalNewCovers };
	}

	/**
	 * Processa novas capas, verificando duplicatas por hash da imagem.
	 * @param book Livro para adicionar as capas
	 * @param scrapedCovers Capas extraídas do scraping
	 * @param refererUrl URL de origem para usar como referer no download
	 * @returns Número de novas capas adicionadas
	 */
	private async processNewCovers(
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
				// Baixa a imagem e calcula o hash
				const imageHash = await this.calculateImageHash(
					scrapedCover.url,
					refererUrl,
				);

				// Verifica se já existe uma capa com esse hash
				if (existingHashes.has(imageHash)) {
					this.logger.debug(
						`Cover already exists (hash match): ${scrapedCover.url}`,
					);
					continue;
				}

				// Cria a nova capa
				const cover = this.coverRepository.create({
					url: normalizeUrl(scrapedCover.url), // Será atualizada depois pelo CoverImageProcessor
					originalUrl: normalizeUrl(scrapedCover.url),
					title:
						scrapedCover.title ||
						`Capa ${book.covers.length + newCoversCount + 1}`,
					imageHash: imageHash,
					selected: book.covers.length === 0 && newCoversCount === 0, // Primeira capa é selecionada
					book: book,
				});

				const savedCover = await this.coverRepository.save(cover);
				existingHashes.add(imageHash);
				newCoversCount++;

				// Adiciona a capa à fila para download da imagem
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
	 * Calcula o hash SHA-256 do conteúdo de uma imagem.
	 * Suporta tanto URLs HTTP/HTTPS quanto caminhos de arquivo locais.
	 * @param imageSource URL ou caminho local da imagem
	 * @param refererUrl URL de origem para usar como referer (opcional)
	 * @returns Hash da imagem em hexadecimal
	 */
	private async calculateImageHash(
		imageSource: string,
		refererUrl?: string,
	): Promise<string> {
		let buffer: Buffer;

		// Verifica se é uma URL ou um caminho local
		if (
			imageSource.startsWith('http://') ||
			imageSource.startsWith('https://')
		) {
			// Se refererUrl não for fornecido, usa a origem da imagem como contexto
			// Isso garante que usamos o browser (Playwright) em vez de fetch direto,
			// evitando bloqueios 403 e problemas de fingerprint
			const pageUrl = refererUrl || new URL(imageSource).origin;

			try {
				buffer = await this.scrapingService.fetchImageBuffer(
					pageUrl,
					imageSource,
				);
			} catch (error) {
				this.logger.error(
					`Failed to download image for hash calculation: ${imageSource} (referer: ${pageUrl})`,
					error,
				);
				throw error;
			}
		} else {
			// É um caminho local - converte o caminho público para o caminho real
			// O caminho público é '/data/xxx.webp', mas o real é '/usr/src/app/data/xxx.webp'
			const realPath = imageSource.startsWith('/data/')
				? imageSource.replace('/data/', '/usr/src/app/data/')
				: imageSource;

			buffer = await readFile(realPath);
		}

		return createHash('sha256').update(buffer).digest('hex');
	}
}
