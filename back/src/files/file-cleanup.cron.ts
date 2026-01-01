import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileCleanupService } from './file-cleanup.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileCleanupCron {
	private readonly logger = new Logger(FileCleanupCron.name);
	private readonly enabled: boolean;

	constructor(
		private readonly fileCleanupService: FileCleanupService,
		private readonly configService: ConfigService,
	) {
		this.enabled =
			this.configService.get<string>('FILE_CLEANUP_ENABLED', 'true') ===
			'true';
	}

	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	async dailyCleanupOldDeletedFiles() {
		if (!this.enabled) {
			this.logger.log('File cleanup is disabled');
			return;
		}

		this.logger.log('Starting daily cleanup of old deleted files...');

		try {
			const report =
				await this.fileCleanupService.cleanupOldDeletedFiles();

			this.logger.log(
				`Daily cleanup completed: ${report.filesDeleted} files deleted, ` +
					`${(report.spaceRecovered / 1024 / 1024).toFixed(2)} MB recovered, ` +
					`${report.errors.length} errors`,
			);

			if (report.errors.length > 0) {
				this.logger.error('Errors during cleanup:', report.errors);
			}
		} catch (error) {
			this.logger.error('Error during daily cleanup:', error);
		}
	}

	@Cron(CronExpression.MONDAY_TO_FRIDAY_AT_3AM)
	async weeklyOrphanScan() {
		if (!this.enabled) {
			return;
		}

		this.logger.log('Starting weekly orphan file scan...');

		try {
			const orphanFiles = await this.fileCleanupService.findOrphanFiles();
			const totalSize = orphanFiles.reduce(
				(sum, file) => sum + file.size,
				0,
			);

			this.logger.log(
				`Weekly scan completed: ${orphanFiles.length} orphan files found, ` +
					`${(totalSize / 1024 / 1024).toFixed(2)} MB`,
			);

			if (orphanFiles.length > 0) {
				this.logger.warn(
					`Found ${orphanFiles.length} orphan files. ` +
						`Run cleanup endpoint to remove them.`,
				);
			}
		} catch (error) {
			this.logger.error('Error during weekly orphan scan:', error);
		}
	}

	@Cron('0 4 * * 1')
	async weeklyIntegrityCheck() {
		if (!this.enabled) {
			return;
		}

		this.logger.log('Starting weekly integrity check...');

		try {
			const missingFiles =
				await this.fileCleanupService.findMissingFiles();

			this.logger.log(
				`Integrity check completed: ${missingFiles.length} missing files`,
			);

			if (missingFiles.length > 0) {
				this.logger.error(
					`Found ${missingFiles.length} database records referencing missing files!`,
				);

				const byType = {
					pages: missingFiles.filter((f) => f.entityType === 'page')
						.length,
					covers: missingFiles.filter((f) => f.entityType === 'cover')
						.length,
				};

				this.logger.error(
					`Missing files by type: ${JSON.stringify(byType)}`,
				);
			}
		} catch (error) {
			this.logger.error('Error during weekly integrity check:', error);
		}
	}

	@Cron('0 5 1 * *')
	async monthlyStatisticsReport() {
		if (!this.enabled) {
			return;
		}

		this.logger.log('Generating monthly statistics report...');

		try {
			const stats = await this.fileCleanupService.getStorageStatistics();

			this.logger.log(
				`Monthly stats: ${stats.totalFiles} files, ` +
					`${stats.totalSizeMB} MB total, ` +
					`${stats.referencedPages} pages, ` +
					`${stats.referencedCovers} covers, ` +
					`${stats.deletedPages} deleted pages, ` +
					`${stats.deletedCovers} deleted covers`,
			);
		} catch (error) {
			this.logger.error('Error generating monthly report:', error);
		}
	}
}
