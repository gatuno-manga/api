import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientKafka } from '@nestjs/microservices';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { WebsiteService } from '@websites/application/services/website.service';
import { Repository } from 'typeorm';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Page } from '@books/infrastructure/database/entities/page.entity';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { v7 as uuidv7 } from 'uuid';

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
		private readonly websiteService: WebsiteService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async onModuleInit() {
		await this.scraperClient.connect();
	}

	async processChapterPages(chapter: Chapter): Promise<boolean> {
		const chapterInfo = `${chapter.book?.title || 'Unknown'} (${chapter.index})`;

		this.logger.debug(`Solicitando scraping para capítulo: ${chapterInfo}`);

		const lockKey = `lock:scraping:chapter:${chapter.id}`;
		const redis = this.redisService.getClient();

		const acquired = await redis.set(lockKey, '1', 'EX', 180, 'NX');

		if (!acquired) {
			this.logger.warn(
				`Chapter ${chapter.id} is already being scraped. Request ignored.`,
			);
			throw new ConflictException(
				`O capítulo ${chapter.id} já está sendo processado.`,
			);
		}

		try {
			const host = new URL(chapter.originalUrl).hostname;
			const websiteConfig = await this.websiteService.getByUrl(host);

			if (!websiteConfig) {
				this.logger.warn(`No website config found for host: ${host}`);
				this.emitFailedEvent(
					chapter,
					'Configuração do site não encontrada',
				);
				return false;
			}

			const payload = {
				jobId: uuidv7(),
				chapterId: chapter.id,
				bookId: chapter.book?.id,
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
						chapterTitle: websiteConfig.selector,
						chapterImages: websiteConfig.selector,
					},
					headers: {
						Referer: host,
					},
				},
				uploadTarget: {
					bucket: 'processing',
					pathPrefix: `${chapter.id.slice(-2)}/${chapter.id}`,
				},
			};

			await this.pageRepository.delete({ chapter: { id: chapter.id } });
			chapter.scrapingStatus = ScrapingStatus.PROCESS;
			await this.chapterRepository.save(chapter);

			this.scraperClient
				.emit('scraping.chapter.requested', payload)
				.subscribe({
					next: () => {
						this.logger.log(
							`Chapter scraping request successfully emitted to Kafka: ${chapter.id}`,
						);
					},
					error: (err) => {
						this.logger.error(
							`Failed to emit chapter scraping request to Kafka for chapter ${chapter.id}: ${err.message}`,
						);
						// Revert status and remove lock
						this.chapterRepository
							.update(chapter.id, {
								scrapingStatus: ScrapingStatus.ERROR,
							})
							.catch((updateErr) => {
								this.logger.error(
									`Failed to revert status after Kafka emit error: ${updateErr.message}`,
								);
							});
						this.redisService
							.getClient()
							.del(lockKey)
							.catch((delErr) => {
								this.logger.error(
									`Failed to remove lock after Kafka emit error: ${delErr.message}`,
								);
							});
					},
				});

			this.emitStartedEvent(chapter);

			this.logger.log(
				`Requisição enviada para o microserviço: ${chapterInfo}`,
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

	emitStartedEvent(chapter: Chapter): void {
		this.eventEmitter.emit('chapter.scraping.started', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
		});
	}

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

	emitFailedEvent(chapter: Chapter, error: string): void {
		this.eventEmitter.emit('chapter.scraping.failed', {
			chapterId: chapter.id,
			bookId: chapter.book?.id,
			error,
		});

		this.eventEmitter.emit('chapters.updated', chapter);
	}
}
