import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../database/entities/chapter.entity';
import { ChapterComment } from '../database/entities/chapter-comment.entity';
import { QueueTextProcessingDto } from '../../application/dto/queue-text-processing.dto';
import { ContentFormat } from '../../domain/enums/content-format.enum';
import { ScrapingService } from '../../../scraping/application/services/scraping.service';
import { AppConfigService } from '../../../infrastructure/app-config/app-config.service';
import { MediaUrlService } from '../../../common/services/media-url.service';
import { StorageBucket } from '../../../common/enum/storage-bucket.enum';
import * as cheerio from 'cheerio';

const QUEUE_NAME = 'text-processing-queue';

@Processor(QUEUE_NAME, { lockDuration: 120000 })
export class TextProcessingProcessor extends WorkerHost {
	private readonly logger = new Logger(TextProcessingProcessor.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(ChapterComment)
		private readonly chapterCommentRepository: Repository<ChapterComment>,
		private readonly scrapingService: ScrapingService,
		private readonly configService: AppConfigService,
		private readonly mediaUrlService: MediaUrlService,
	) {
		super();
	}

	async process(job: Job<QueueTextProcessingDto>): Promise<void> {
		const { entityId, source, format } = job.data;
		this.logger.debug(
			`Processing text for ${source} ${entityId} (${format})`,
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
				`Found ${externalUrls.length} external images in ${source} ${entityId}. Mirroring...`,
			);

			// Use a generic origin for mirroring if we don't have one
			const origin = this.configService.apiUrl;
			const mirroredData =
				await this.scrapingService.scrapeMultipleImages(
					origin,
					externalUrls,
				);

			const urlMap = new Map<string, string>();
			for (let i = 0; i < externalUrls.length; i++) {
				const result = mirroredData[i];
				if (result?.path) {
					// Resolve path to full internal URL
					const internalUrl = this.mediaUrlService.resolveUrl(
						result.path,
						StorageBucket.BOOKS,
					);
					urlMap.set(externalUrls[i], internalUrl);
				}
			}

			if (urlMap.size === 0) {
				this.logger.warn(
					`Failed to mirror any images for ${source} ${entityId}`,
				);
				return;
			}

			const updatedContent = await this.replaceUrlsInText(
				content,
				format,
				urlMap,
			);

			if (source === 'CHAPTER') {
				await this.chapterRepository.update(entityId, {
					content: updatedContent,
				});
			} else if (source === 'COMMENT') {
				await this.chapterCommentRepository.update(entityId, {
					content: updatedContent,
				});
			}

			this.logger.log(
				`Successfully mirrored ${urlMap.size} images for ${source} ${entityId}`,
			);
		} catch (error) {
			this.logger.error(
				`Error processing text for ${source} ${entityId}`,
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

	private async replaceUrlsInText(
		content: string,
		format: ContentFormat,
		urlMap: Map<string, string>,
	): Promise<string> {
		if (format === ContentFormat.HTML) {
			const $ = cheerio.load(content, null, false); // No wrapper
			$('img').each((_, img) => {
				const src = $(img).attr('src');
				if (src) {
					const mirroredUrl = urlMap.get(src);
					if (mirroredUrl) {
						$(img).attr('src', mirroredUrl);
					}
				}
			});
			return $.html();
		}

		if (format === ContentFormat.MARKDOWN) {
			const { remark } = await import('remark');
			const { visit } = await import('unist-util-visit');

			const processor = remark();
			const ast = processor.parse(content);

			visit(ast, 'image', (node: { url: string }) => {
				if (node.url) {
					const mirroredUrl = urlMap.get(node.url);
					if (mirroredUrl) {
						node.url = mirroredUrl;
					}
				}
			});

			return processor.stringify(ast);
		}

		return content;
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
