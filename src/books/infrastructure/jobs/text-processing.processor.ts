import { AppConfigService } from '@app-config/app-config.service';
import { QueueTextProcessingDto } from '@books/application/dto/queue-text-processing.dto';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { ChapterComment } from '@books/infrastructure/database/entities/chapter-comment.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { MediaUrlService } from '@common/services/media-url.service';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import * as cheerio from 'cheerio';
import { Repository } from 'typeorm';

const QUEUE_NAME = 'text-processing-queue';

@Processor(QUEUE_NAME, { lockDuration: 120000 })
export class TextProcessingProcessor
	extends WorkerHost
	implements OnModuleInit
{
	private readonly logger = new Logger(TextProcessingProcessor.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(ChapterComment)
		private readonly chapterCommentRepository: Repository<ChapterComment>,
		@Inject('SCRAPER_SERVICE')
		private readonly scraperClient: ClientKafka,
		private readonly configService: AppConfigService,
		private readonly mediaUrlService: MediaUrlService,
	) {
		super();
	}

	async onModuleInit() {
		await this.scraperClient.connect();
	}

	async process(job: Job<QueueTextProcessingDto>): Promise<void> {
		const { entityId, source, format } = job.data;
		this.logger.debug(
			`Solicitando espelhamento de texto para ${source} ${entityId} (${format})`,
		);

		try {
			let content = '';
			let entity: Chapter | ChapterComment | null = null;

			if (source === 'CHAPTER') {
				entity = await this.chapterRepository.findOne({
					where: { id: entityId },
				});
				content = (entity as Chapter)?.content || '';
			} else if (source === 'COMMENT') {
				entity = await this.chapterCommentRepository.findOne({
					where: { id: entityId },
				});
				content = (entity as ChapterComment)?.content || '';
			}

			if (!entity || !content) {
				this.logger.warn(
					`${source} ${entityId} not found or has no content`,
				);
				return;
			}

			const externalUrls = await this.extractExternalUrls(
				content,
				format,
			);
			if (externalUrls.length === 0) {
				this.logger.debug(
					`No external images found in ${source} ${entityId}`,
				);
				return;
			}

			this.logger.log(
				`Found ${externalUrls.length} external images in ${source} ${entityId}. Requesting mirror...`,
			);

			const payload = {
				jobId: job.id,
				entityId: entityId,
				source: source,
				format: format,
				urls: externalUrls,
				uploadTarget: {
					bucket: StorageBucket.PROCESSING,
				},
			};

			// Emite para o microserviço Go
			this.scraperClient
				.emit('scraping.images.requested', payload)
				.subscribe({
					next: () => {
						this.logger.log(
							`Image mirroring request successfully emitted to Kafka for ${source}: ${entityId}`,
						);
					},
					error: (err: unknown) => {
						this.logger.error(
							`Failed to emit image mirroring request to Kafka for ${source} ${entityId}: ${err instanceof Error ? err.message : String(err)}`,
						);
					},
				});

			this.logger.log(
				`Requisição de espelhamento enviada para o microserviço: ${source} ${entityId}`,
			);
		} catch (error) {
			this.logger.error(
				`Error requesting mirror for ${source} ${entityId}`,
				error,
			);
			throw error;
		}
	}

	private async extractExternalUrls(
		content: string,
		format: ContentFormat,
	): Promise<string[]> {
		const urls: string[] = [];
		const internalHost = new URL(this.configService.rustfsPublicUrl)
			.hostname;

		if (format === ContentFormat.HTML) {
			const $ = cheerio.load(content);
			$('img').each((_, img) => {
				const src = $(img).attr('src');
				if (src && this.isExternalUrl(src, internalHost)) {
					urls.push(src);
				}
			});
		} else if (format === ContentFormat.MARKDOWN) {
			// Dynamic import for ESM remark packages
			const { remark } = await import('remark');
			const { visit } = await import('unist-util-visit');

			const ast = remark().parse(content);
			visit(ast, 'image', (node: { url: string }) => {
				if (node.url && this.isExternalUrl(node.url, internalHost)) {
					urls.push(node.url);
				}
			});
		}

		return [...new Set(urls)]; // Deduplicate
	}

	private isExternalUrl(url: string, internalHost: string): boolean {
		try {
			if (!url.startsWith('http')) return false;
			const urlObj = new URL(url);
			return urlObj.hostname !== internalHost;
		} catch {
			return false;
		}
	}

	@OnWorkerEvent('failed')
	onFailed(job: Job<QueueTextProcessingDto>) {
		this.logger.error(
			`Text processing job ${job.id} FAILED for ${job.data.source} ${job.data.entityId}`,
			job.failedReason,
		);
	}
}
