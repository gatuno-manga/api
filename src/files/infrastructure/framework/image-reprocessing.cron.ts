import { AppConfigService } from '@/infrastructure/app-config/app-config.service';
import { ImageReprocessingService } from '@files/application/services/image-reprocessing.service';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

const CRON_JOB_NAME = 'image-reprocessing-cron';

/**
 * Reprocessa imagens pendentes (uploads travados, sem metadados, ou capas sem
 * variantes de resolução menor). Complementa o ScrapingRecoveryScheduler, que
 * re-scrapeia a partir da URL externa em caso de erro — este aqui reprocessa
 * bytes que já estão no S3.
 */
@Injectable()
export class ImageReprocessingCron implements OnModuleInit {
	private readonly logger = new Logger(ImageReprocessingCron.name);

	constructor(
		private readonly imageReprocessingService: ImageReprocessingService,
		private readonly appConfigService: AppConfigService,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	onModuleInit() {
		if (!this.appConfigService.imageReprocessing.enabled) {
			this.logger.log('Image reprocessing cron is disabled');
			return;
		}

		const cronExpression =
			this.appConfigService.imageReprocessing.cronExpression;
		const job = new CronJob(cronExpression, () => {
			this.run().catch((error) => {
				this.logger.error(
					`Image reprocessing job failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			});
		});

		this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
		job.start();
	}

	private async run(): Promise<void> {
		this.logger.log('Starting image reprocessing scan...');

		try {
			const { totalRequested } =
				await this.imageReprocessingService.reprocessAll();
			this.logger.log(
				`Image reprocessing scan completed: ${totalRequested} request(s) sent.`,
			);
		} catch (error) {
			this.logger.error(
				`Error during image reprocessing scan: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
