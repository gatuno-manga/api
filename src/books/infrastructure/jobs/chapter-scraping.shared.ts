import { BookEvents } from '@books/domain/constants/events.constant';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { RedisService } from '@infrastructure/redis/redis.service';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import { Repository } from 'typeorm';

type ChapterPageInput =
	| string
	| { originalUrl?: string; original_url?: string; path: string };

interface OptimizedPageData {
	path?: string;
	originalPath: string;
	metadata?: ImageMetadata;
}

/**
 * Serviço compartilhado para processamento de scraping de capítulos.
 * Elimina duplicação de código entre ChapterScrapingJob e FixChapterProcessor.
 */
@Injectable()
export class ChapterScrapingSharedService implements OnModuleInit {
	private readonly logger = new Logger(ChapterScrapingSharedService.name);

	constructor(
		@InjectRepository(Page)
		private readonly pageRepository: Repository<Page>,
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly redisService: RedisService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async onModuleInit() {
		await this.scraperClient.connect();
	}

	/**
	 * Processa o scraping de páginas de um capítulo (direto).
	 * @deprecated Use requestScrapingViaGo para o novo fluxo com microserviço Go
	 */
	processChapterPages(
		chapter: Chapter,
		_minPages?: number,
	): Promise<boolean> {
		this.logger.warn(
			`Processamento direto de capítulos está desativado. Use o microserviço Go. Capítulo: ${chapter.id}`,
		);
		return Promise.resolve(false);
	}

	/**
	 * Dispara a solicitação de scraping para o microserviço em Go via Kafka.
	 */
	async requestScrapingViaGo(
		chapter: Chapter,
		useFlareSolverr = false,
	): Promise<boolean> {
		try {
			const book = chapter.book;

			this.emitStartedEvent(chapter);

			const payload = {
				chapterId: chapter.id,
				bookId: book?.id,
				targetUrl: chapter.originalUrl,
				useFlareSolverr,
				uploadTarget: {
					bucket: 'books',
					pathPrefix: `processing/${chapter.id}`,
				},
			};

			this.scraperClient.emit('scraping.chapter.requested', payload);
			this.logger.debug(
				`Solicitação de scraping enviada para o microserviço Go: Capítulo ${chapter.id}`,
			);

			return true;
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			this.logger.error(
				`Falha ao disparar scraping do capítulo ${chapter.id}: ${errorMessage}`,
			);

			const lockKey = `lock:scraping:chapter:${chapter.id}`;
			await this.redisService.getClient().del(lockKey);

			chapter.scrapingStatus = ScrapingStatus.ERROR;
			await this.chapterRepository.save(chapter);

			this.emitFailedEvent(chapter, errorMessage);
			return false;
		}
	}

	/**
	 * Emite evento de início do scraping
	 */
	emitStartedEvent(chapter: Chapter): void {
		this.eventEmitter.emit(BookEvents.SCRAPING_STARTED, {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
		});
	}

	/**
	 * Emite evento de falha no scraping
	 */
	emitFailedEvent(chapter: Chapter, error: string): void {
		this.eventEmitter.emit(BookEvents.SCRAPING_FAILED, {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			error,
		});
	}

	/**
	 * Método legado mantido para compatibilidade.
	 * @deprecated Use finalizeChapterScraping
	 */
	async saveExtractedPages(
		chapter: Chapter,
		images: ChapterPageInput[],
	): Promise<void> {
		return this.finalizeChapterScraping(chapter.id, images);
	}

	/**
	 * Finaliza o scraping, atualizando as páginas no banco de dados.
	 * Suporta atualização otimizada (sem deletar tudo) se o número de páginas for igual.
	 */
	async finalizeChapterScraping(
		chapterId: string,
		pagesPaths: ChapterPageInput[],
	): Promise<void> {
		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['book'],
		});

		if (!chapter) {
			this.logger.error(
				`Capítulo ${chapterId} não encontrado para finalização.`,
			);
			return;
		}

		// Buscar páginas existentes
		const existingPages = await this.pageRepository.find({
			where: { chapter: { id: chapter.id } },
			order: { index: 'ASC' },
		});

		const redis = this.redisService.getClient();

		// Mapeia os caminhos otimizados se existirem no Redis
		const optimizedData = await Promise.all(
			pagesPaths.map(async (item) => {
				const path = typeof item === 'string' ? item : item.path;

				const cacheKey = `pending_optimization:${path}`;
				const cached = await redis.get(cacheKey);
				if (cached) {
					try {
						const data = JSON.parse(cached) as Partial<
							ImageMetadata & { path: string }
						>;
						return {
							originalPath: path,
							...data,
						} as OptimizedPageData;
					} catch (_e) {
						return { originalPath: path } as OptimizedPageData;
					}
				}
				return { originalPath: path } as OptimizedPageData;
			}),
		);

		if (existingPages.length === pagesPaths.length) {
			// Atualização otimizada: Apenas troca os caminhos externos pelos internos do S3
			this.logger.debug(
				`Finalizando capítulo ${chapter.id}: Atualizando ${existingPages.length} páginas existentes.`,
			);
			for (let i = 0; i < existingPages.length; i++) {
				const data = optimizedData[i];
				existingPages[i].path = data.path || data.originalPath;
				existingPages[i].metadata = data.metadata || null;
			}
			await this.pageRepository.save(existingPages);
		} else {
			// Fallback: Deleta e recria (caso o número de páginas tenha mudado ou não existissem)
			this.logger.debug(
				`Finalizando capítulo ${chapter.id}: Recriando páginas (mismatch ou novas).`,
			);
			await this.pageRepository.delete({ chapter: { id: chapter.id } });

			let index = 1;
			const newPages = optimizedData.map((data) =>
				this.pageRepository.create({
					path: data.path || data.originalPath,
					metadata: data.metadata || null,
					index: index++,
					chapter: chapter,
				}),
			);
			await this.pageRepository.save(newPages);
		}

		chapter.scrapingStatus = ScrapingStatus.READY;
		await this.chapterRepository.save(chapter);

		const cleanPromises = pagesPaths.map((item) => {
			let path = typeof item === 'string' ? item : item.path;
			path = this.ensureProcessingPrefix(path);
			return redis.del(`pending_optimization:${path}`);
		});
		await Promise.all(cleanPromises).catch(() => {});

		this.eventEmitter.emit(BookEvents.SCRAPING_COMPLETED, {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			pagesCount: pagesPaths.length,
		});
	}

	private ensureProcessingPrefix(path: string): string {
		if (!path.startsWith('http') && !path.startsWith('processing/')) {
			return `processing/${path}`;
		}
		return path;
	}
}
