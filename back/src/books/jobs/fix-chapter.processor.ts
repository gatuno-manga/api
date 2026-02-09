import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Repository } from 'typeorm';
import { Chapter } from '../entities/chapter.entity';
import { ChapterScrapingSharedService } from './chapter-scraping.shared';

const QUEUE_NAME = 'fix-chapter-queue';

@Processor(QUEUE_NAME)
export class FixChapterProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(FixChapterProcessor.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly configService: AppConfigService,
		private readonly chapterScrapingShared: ChapterScrapingSharedService,
	) {
		super();
	}

	onModuleInit() {
		this.worker.concurrency =
			this.configService.queueConcurrency.fixChapter;
	}

	async process(job: Job<{ chapterId: string }>): Promise<void> {
		const { chapterId } = job.data;
		this.logger.debug(`Processando conserto para o capítulo: ${chapterId}`);

		const chapter = await this.chapterRepository.findOne({
			where: { id: chapterId },
			relations: ['book', 'pages'],
		});

		if (!chapter) {
			this.logger.warn(`Capítulo com ID ${chapterId} não encontrado.`);
			throw new Error(`Capítulo com ID ${chapterId} não encontrado.`);
		}

		// Emite evento de início
		this.chapterScrapingShared.emitStartedEvent(chapter);

		// Processa usando o serviço compartilhado com minPages
		const minPages = chapter.pages?.length || undefined;
		await this.chapterScrapingShared.processChapterPages(chapter, minPages);

		this.logger.log(`Capítulo ${chapterId} processado para conserto.`);
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<{ chapterId: string }>): Promise<void> {
		const { chapterId } = job.data;
		this.logger.error(
			`Job de conserto com id ${job.id} FAILED! Attempt ${job.attemptsMade} for chapter ID: ${chapterId}`,
		);

		try {
			const chapter = await this.chapterRepository.findOne({
				where: { id: chapterId },
				relations: ['book'],
			});

			if (chapter) {
				this.chapterScrapingShared.emitFailedEvent(
					chapter,
					job.failedReason || 'Unknown error',
				);
			}
		} catch (error) {
			this.logger.error(
				`Erro ao emitir evento de falha para o capítulo ${chapterId}: ${error.message}`,
			);
		}
	}
}
