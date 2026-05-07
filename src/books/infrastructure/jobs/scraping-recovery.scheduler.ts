import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { AppConfigService } from 'src/infrastructure/app-config/app-config.service';
import { LessThan, Repository } from 'typeorm';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ChapterScrapingService } from './chapter-scraping.service';
import { CoverImageService } from './cover-image.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookEvents } from '@books/domain/constants/events.constant';

const CRON_JOB_NAME = 'scraping-recovery-cron';

/**
 * Job agendado para recuperar scrapings que falharam ou travaram.
 */
@Injectable()
export class ScrapingRecoveryScheduler implements OnModuleInit {
	private readonly logger = new Logger(ScrapingRecoveryScheduler.name);

	constructor(
		@InjectRepository(Chapter)
		private readonly chapterRepository: Repository<Chapter>,
		@InjectRepository(Cover)
		private readonly coverRepository: Repository<Cover>,
		private readonly chapterScrapingService: ChapterScrapingService,
		private readonly coverImageService: CoverImageService,
		private readonly configService: AppConfigService,
		private readonly schedulerRegistry: SchedulerRegistry,
		private readonly eventEmitter: EventEmitter2,
	) {}

	onModuleInit() {
		if (!this.configService.scrapingRecovery?.enabled) {
			this.logger.log('Scraping recovery is disabled');
			return;
		}

		const cronExpression =
			this.configService.scrapingRecovery.cronExpression;
		this.logger.log(
			`Registering scraping recovery cron job with expression: ${cronExpression}`,
		);

		const job = new CronJob(cronExpression, () => {
			this.handleRecovery();
		});

		this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
		job.start();
	}

	/**
	 * Executa a lógica de recuperação
	 */
	async handleRecovery(): Promise<void> {
		this.logger.log('Starting scraping recovery check...');

		await Promise.all([
			this.recoverChapters(),
			this.recoverCovers(),
			this.cleanStuckJobs(),
		]);

		this.logger.log('Scraping recovery check completed');
	}

	/**
	 * Recupera capítulos em estado de erro
	 */
	private async recoverChapters(): Promise<void> {
		const maxRetries = this.configService.scrapingRecovery.maxRetries;

		const failedChapters = await this.chapterRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.ERROR,
				retries: LessThan(maxRetries),
			},
			relations: ['book'],
		});

		if (failedChapters.length > 0) {
			this.logger.log(
				`Recovering ${failedChapters.length} failed chapters`,
			);
			for (const chapter of failedChapters) {
				await this.chapterScrapingService.addChapterToQueue(chapter.id);
			}
		}

		// Notificar falhas permanentes
		const permanentFailures = await this.chapterRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.ERROR,
				retries: maxRetries,
			},
			relations: ['book'],
		});

		for (const chapter of permanentFailures) {
			this.eventEmitter.emit(BookEvents.SCRAPING_PERMANENT_FAILURE, {
				entityType: 'chapter',
				entityId: chapter.id,
				bookId: chapter.book?.id,
				retries: chapter.retries,
				error: 'Max retries reached',
			});
		}
	}

	/**
	 * Recupera capas em estado de erro
	 */
	private async recoverCovers(): Promise<void> {
		const maxRetries = this.configService.scrapingRecovery.maxRetries;

		const failedCovers = await this.coverRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.ERROR,
				retries: LessThan(maxRetries),
			},
			relations: ['book'],
		});

		if (failedCovers.length > 0) {
			this.logger.log(`Recovering ${failedCovers.length} failed covers`);
			for (const cover of failedCovers) {
				await this.coverImageService.addCoverToQueueById(cover.id);
			}
		}

		// Notificar falhas permanentes
		const permanentFailures = await this.coverRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.ERROR,
				retries: maxRetries,
			},
			relations: ['book'],
		});

		for (const cover of permanentFailures) {
			this.eventEmitter.emit(BookEvents.SCRAPING_PERMANENT_FAILURE, {
				entityType: 'cover',
				entityId: cover.id,
				bookId: cover.book?.id,
				retries: cover.retries,
				error: 'Max retries reached',
			});
		}
	}

	/**
	 * Limpa jobs que ficaram presos em status PROCESS
	 */
	private async cleanStuckJobs(): Promise<void> {
		const thresholdHours =
			this.configService.scrapingRecovery.stuckThresholdHours;
		const stuckDate = new Date();
		stuckDate.setHours(stuckDate.getHours() - thresholdHours);

		// Capítulos presos
		const stuckChapters = await this.chapterRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.PROCESS,
				updatedAt: LessThan(stuckDate),
			},
		});

		if (stuckChapters.length > 0) {
			this.logger.warn(
				`Found ${stuckChapters.length} stuck chapters. Re-enqueuing...`,
			);
			for (const chapter of stuckChapters) {
				await this.chapterScrapingService.addChapterToQueue(chapter.id);
			}
		}

		// Capas presas
		const stuckCovers = await this.coverRepository.find({
			where: {
				scrapingStatus: ScrapingStatus.PROCESS,
				updatedAt: LessThan(stuckDate),
			},
		});

		if (stuckCovers.length > 0) {
			this.logger.warn(
				`Found ${stuckCovers.length} stuck covers. Re-enqueuing...`,
			);
			for (const cover of stuckCovers) {
				await this.coverImageService.addCoverToQueueById(cover.id);
			}
		}
	}
}
