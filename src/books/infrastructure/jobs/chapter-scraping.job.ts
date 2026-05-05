import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { DataSource, Repository } from 'typeorm';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { ChapterScrapingSharedService } from './chapter-scraping.shared';

const QUEUE_NAME = 'chapter-scraping';

@Processor(QUEUE_NAME, { lockDuration: 120000 })
export class ChapterScrapingJob extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(ChapterScrapingJob.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		private readonly dataSource: DataSource,
		private readonly configService: AppConfigService,
		private readonly chapterScrapingShared: ChapterScrapingSharedService,
	) {
		super();
	}

	onModuleInit() {
		const concurrency = this.configService.queueConcurrency.chapterScraping;
		this.worker.concurrency = concurrency;
		this.logger.log(`Worker initialized with concurrency: ${concurrency}`);
	}

	@OnWorkerEvent('ready')
	onReady() {
		this.logger.log('Worker is ready and listening for jobs');
	}

	@OnWorkerEvent('error')
	onError(error: Error) {
		this.logger.error(`Worker error: ${error.message}`, error.stack);
	}

	async process(job: Job<string>): Promise<void> {
		const chapterId = job.data;
		this.logger.debug(
			`Iniciando processamento do job: ${job.id} para o capítulo: ${chapterId}`,
		);
		const startTime = Date.now();

		const chapter = await this.getChapter(chapterId);

		if (!chapter) {
			this.logger.error(
				`Capítulo com ID ${chapterId} não encontrado. Job ${job.id} falhará.`,
			);
			throw new Error(`Capítulo com ID ${chapterId} não encontrado.`);
		}

		await this.chapterScrapingShared.processChapterPages(chapter);

		const endTime = Date.now();
		this.logger.debug(
			`Job ${job.id} finalizado. Tempo total: ${(endTime - startTime) / 1000}s`,
		);
	}

	private async getChapter(chapterId: string): Promise<Chapter | null> {
		return await this.dataSource.manager.findOne(Chapter, {
			where: { id: chapterId },
			relations: ['book', 'pages'],
			comment: 'force_master',
		});
	}

	@OnWorkerEvent('active')
	async onActive(job: Job<string>): Promise<void> {
		const chapterId = job.data;

		try {
			const chapter = await this.dataSource.manager.findOne(Chapter, {
				where: { id: chapterId },
				relations: ['book'],
				comment: 'force_master',
			});

			if (chapter) {
				// Emite evento de scraping iniciado
				this.chapterScrapingShared.emitStartedEvent(chapter);

				// Incrementa contador de tentativas
				chapter.retries += 1;
				await this.dataSource.manager.save(chapter);
			}
		} catch (error) {
			this.logger.error(
				`Erro ao incrementar retentativa para o capítulo ${chapterId}: ${error.message}`,
			);
		}
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<string>): Promise<void> {
		const chapterId = job.data;
		this.logger.error(
			`Job with id ${job.id} FAILED! Attempt Number ${job.attemptsMade} for chapter ID: ${chapterId}`,
		);

		try {
			const chapter = await this.dataSource.manager.findOne(Chapter, {
				where: { id: chapterId },
				relations: ['book'],
				comment: 'force_master',
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
