import { QueueCoverProcessorDto } from '@books/application/dto/queue-cover-processor.dto';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { WebsiteService } from '@websites/application/services/website.service';
import { Job } from 'bullmq';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { RedisService } from 'src/infrastructure/redis/redis.service';
import { DataSource, In, Repository } from 'typeorm';

const QUEUE_NAME = 'cover-image-queue';

@Processor(QUEUE_NAME, { lockDuration: 120000 })
export class CoverImageProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(CoverImageProcessor.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly websiteService: WebsiteService,
		private readonly dataSource: DataSource,
		private readonly configService: AppConfigService,
		private readonly eventEmitter: EventEmitter2,
		private readonly redisService: RedisService,
	) {
		super();
	}

	onModuleInit() {
		this.worker.concurrency =
			this.configService.queueConcurrency.coverImage;

		// Conecta em background para não bloquear o bootstrap da API
		this.scraperClient.connect().catch((error) => {
			this.logger.error(
				`[CoverImageProcessor] Falha ao conectar ao Scraper Kafka em background: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
	}

	@OnWorkerEvent('active')
	async onActive(job: Job<QueueCoverProcessorDto>) {
		const { covers, bookId } = job.data;
		if (!covers || covers.length === 0) return;

		const urls = covers.map((c) => c.url);

		try {
			await this.coverRepository
				.createQueryBuilder()
				.update(Cover)
				.set({
					scrapingStatus: ScrapingStatus.PROCESS,
					retries: () => 'retries + 1',
				})
				.where('bookId = :bookId', { bookId })
				.andWhere('originalUrl IN (:...urls)', { urls })
				.execute();
		} catch (error) {
			this.logger.error(
				`Erro ao atualizar status de processamento das capas: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	async process(job: Job<QueueCoverProcessorDto>): Promise<void> {
		const { bookId, urlOrigin } = job.data;
		const jobData = job.data as QueueCoverProcessorDto & {
			cover?: { url: string; title?: string };
		};
		const covers = jobData.covers?.length
			? jobData.covers
			: jobData.cover
				? [jobData.cover]
				: [];

		if (covers.length === 0) return;

		this.logger.debug(
			`Solicitando scraping de ${covers.length} capa(s) para o livro: ${bookId}`,
		);

		try {
			const host = urlOrigin ? new URL(urlOrigin).hostname : null;
			const websiteConfig = host
				? await this.websiteService.getByUrl(host)
				: null;

			const payload = {
				jobId: job.id,
				bookId: bookId,
				urlOrigin: urlOrigin,
				websiteConfig: websiteConfig
					? {
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
							timeoutMultipliers:
								websiteConfig.timeoutMultipliers,
							proxyUrl: websiteConfig.proxyUrl,
							blacklistTerms: websiteConfig.blacklistTerms,
							whitelistTerms: websiteConfig.whitelistTerms,
							selectors: {
								chapterTitle: websiteConfig.selector,
								chapterImages: websiteConfig.selector,
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
						}
					: undefined,
				images: covers.map((c) => ({
					url: c.url,
					title: c.title,
				})),
				uploadTarget: {
					bucket: StorageBucket.PROCESSING,
				},
			};

			const requestedUrls = covers.map((c) => c.url);
			await this.redisService
				.getClient()
				.set(
					`job_covers:${job.id}`,
					JSON.stringify(requestedUrls),
					'EX',
					3600,
				);

			this.scraperClient
				.emit('scraping.covers.requested', payload)
				.subscribe({
					next: () => {
						this.logger.log(
							`Cover scraping request successfully emitted to Kafka for book: ${bookId}`,
						);
					},
					error: (err) => {
						this.logger.error(
							`Failed to emit cover scraping request to Kafka for book ${bookId}: ${err instanceof Error ? err.message : String(err)}`,
						);
						// We don't throw here to avoid job failure if it's just an emit error,
						// but in a production app we might want to mark the covers as FAILED.
					},
				});

			this.logger.log(
				`Requisição de capas enviada ao microserviço para livro: ${bookId}`,
			);
		} catch (err) {
			this.logger.error(
				`Erro ao enviar requisição de capas para o microserviço: ${err instanceof Error ? err.message : String(err)}`,
			);
			throw err;
		}
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<QueueCoverProcessorDto>) {
		this.logger.error(
			`Job de capa com id ${job.id} FAILED!`,
			job.failedReason,
		);

		const { covers, bookId } = job.data;
		if (!covers || covers.length === 0) return;

		const urls = covers.map((c) => c.url);

		try {
			await this.coverRepository.update(
				{
					book: { id: bookId },
					originalUrl: In(urls),
				},
				{ scrapingStatus: ScrapingStatus.ERROR },
			);
		} catch (error) {
			this.logger.error(
				`Erro ao atualizar status de erro das capas: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
