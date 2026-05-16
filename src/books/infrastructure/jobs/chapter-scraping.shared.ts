import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { ClientKafka } from '@nestjs/microservices';
import { WebsiteService } from '@websites/application/services/website.service';
import { v7 as uuidv7 } from 'uuid';

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
		private readonly websiteService: WebsiteService,
		private readonly eventEmitter: EventEmitter2,
		private readonly redisService: RedisService,
	) {}

	async onModuleInit() {
		await this.scraperClient.connect();
	}

	/**
	 * Processa o scraping de páginas de um capítulo (direto).
	 * @deprecated Use requestScrapingViaGo para o novo fluxo com microserviço Go
	 */
	async processChapterPages(
		chapter: Chapter,
		minPages?: number,
	): Promise<boolean> {
		this.logger.warn(
			`Processamento direto de capítulos está desativado. Use o microserviço Go. Capítulo: ${chapter.id}`,
		);
		return false;
	}

	/**
	 * Dispara a solicitação de scraping para o microserviço em Go via Kafka.
	 */
	async requestScrapingViaGo(chapter: Chapter): Promise<boolean> {
		this.logger.log(
			`Disparando scraping via Go para capítulo: ${chapter.id}`,
		);

		try {
			// Adicionar um lock para evitar disparos duplicados
			const redis = this.redisService.getClient();
			const lockKey = `lock:scraping:chapter:${chapter.id}`;
			const isLocked = await redis.set(lockKey, 'true', 'EX', 600, 'NX');

			if (!isLocked) {
				this.logger.warn(
					`Scraping já está em andamento para o capítulo ${chapter.id}`,
				);
				return true;
			}

			const book = chapter.book;
			if (!book) {
				throw new Error(
					`Capítulo ${chapter.id} não possui livro associado`,
				);
			}

			const host = new URL(chapter.originalUrl).hostname;
			const websiteConfig = await this.websiteService.getByUrl(host);

			if (!websiteConfig) {
				throw new Error(
					`Não há configuração de scraping para o site: ${host}`,
				);
			}

			const jobId = uuidv7();
			const payload = {
				jobId,
				chapterId: chapter.id,
				bookId: book.id,
				targetUrl: chapter.originalUrl,
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
						chapterTitle: 'h1', // Default, não temos no DB ainda
						chapterImages: websiteConfig.selector,
					},
					headers: {
						Referer: host,
					},
				},
				uploadTarget: {
					bucket: 'processing',
					pathPrefix: `chapters/${book.id}/${chapter.id}`,
				},
			};

			this.scraperClient.emit('scraping.chapter.requested', payload);

			this.logger.debug(
				`Solicitação de scraping enviada com sucesso para o capítulo ${chapter.id}`,
			);
			return true;
		} catch (error) {
			this.logger.error(
				`Falha ao disparar scraping do capítulo ${chapter.id}: ${error.message}`,
			);

			const lockKey = `lock:scraping:chapter:${chapter.id}`;
			await this.redisService.getClient().del(lockKey);

			chapter.scrapingStatus = ScrapingStatus.ERROR;
			await this.chapterRepository.save(chapter);

			this.emitFailedEvent(chapter, error.message);
			return false;
		}
	}

	/**
	 * Emite evento de início do scraping
	 */
	emitStartedEvent(chapter: Chapter): void {
		this.eventEmitter.emit('chapter.scraping.started', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
		});
	}

	/**
	 * Salva páginas extraídas de um capítulo (URLs externas temporárias).
	 */
	async saveExtractedPages(
		chapter: Chapter,
		externalUrls: string[],
	): Promise<void> {
		if (!externalUrls || !Array.isArray(externalUrls)) {
			this.logger.error(
				`Nenhuma URL externa recebida para o capítulo ${chapter.id}`,
			);
			return;
		}

		this.logger.debug(
			`Fast-Track: Salvando ${externalUrls.length} URLs externas para o capítulo ${chapter.id}`,
		);

		// Remove páginas antigas se houver
		await this.pageRepository.delete({ chapter: { id: chapter.id } });

		let index = 1;
		const newPages = externalUrls.map((url) =>
			this.pageRepository.create({
				path: url,
				index: index++,
				chapter: chapter,
			}),
		);

		await this.pageRepository.save(newPages);

		chapter.scrapingStatus = ScrapingStatus.READY;
		await this.chapterRepository.save(chapter);

		this.eventEmitter.emit('chapters.updated', chapter);
		this.logger.log(
			`Fast-Track: Capítulo ${chapter.id} liberado para leitura com URLs externas.`,
		);
	}

	/**
	 * Finaliza o scraping de um capítulo, convertendo caminhos externos em internos.
	 */
	async finalizeChapterScraping(
		chapter: Chapter,
		pagesPaths: string[],
	): Promise<void> {
		if (!pagesPaths || !Array.isArray(pagesPaths)) {
			this.logger.error(
				`Nenhum caminho de página recebido para o capítulo ${chapter.id}`,
			);
			return;
		}

		const startTime = Date.now();
		const redis = this.redisService.getClient();

		// Busca páginas existentes para atualizar
		const existingPages = await this.pageRepository.find({
			where: { chapter: { id: chapter.id } },
			order: { index: 'ASC' },
		});

		const optimizedData = await Promise.all(
			pagesPaths.map(async (path) => {
				const cacheKey = `pending_optimization:${path}`;
				const cached = await redis.get(cacheKey);
				if (cached) {
					try {
						const data = JSON.parse(cached);
						return { originalPath: path, ...data };
					} catch (e) {
						return { originalPath: path };
					}
				}
				return { originalPath: path };
			}),
		);

		if (existingPages.length === pagesPaths.length) {
			// Atualização otimizada: Apenas troca os caminhos externos pelos internos do S3
			this.logger.debug(
				`Finalizando capítulo ${chapter.id}: Atualizando ${existingPages.length} páginas existentes.`,
			);
			for (let i = 0; i < existingPages.length; i++) {
				existingPages[i].path =
					optimizedData[i].path || optimizedData[i].originalPath;
				existingPages[i].metadata = optimizedData[i].metadata || null;
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

		const cleanPromises = pagesPaths.map((path) =>
			redis.del(`pending_optimization:${path}`),
		);
		await Promise.all(cleanPromises).catch(() => {});

		this.eventEmitter.emit('chapter.scraping.completed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			pagesCount: pagesPaths.length,
		});

		this.eventEmitter.emit('chapters.updated', chapter);

		this.logger.log(
			`Capítulo ${chapter.id} finalizado com ${pagesPaths.length} páginas em ${(Date.now() - startTime) / 1000}s`,
		);
	}

	/**
	 * Emite evento de falha no scraping
	 */
	emitFailedEvent(chapter: Chapter, error: string): void {
		this.eventEmitter.emit('chapter.scraping.failed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			error,
		});

		this.eventEmitter.emit('chapters.updated', chapter);
	}
}
