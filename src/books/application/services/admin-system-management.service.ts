import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CronJob } from 'cron';

@Injectable()
export class AdminSystemManagementService {
	private readonly logger = new Logger(AdminSystemManagementService.name);

	constructor(
		private readonly schedulerRegistry: SchedulerRegistry,
		@InjectQueue('chapter-scraping')
		private readonly chapterScrapingQueue: Queue,
		@InjectQueue('book-update-queue')
		private readonly bookUpdateQueue: Queue,
		@InjectQueue('cover-image-queue')
		private readonly coverImageQueue: Queue,
		@InjectQueue('fix-chapter-queue')
		private readonly fixChapterQueue: Queue,
	) {}

	async listCronJobs() {
		const jobs = this.schedulerRegistry.getCronJobs();
		const result: Array<{
			name: string;
			nextDate: Date | null;
			status: string;
			lastDate: Date | null;
		}> = [];

		jobs.forEach((value, key) => {
			const cronJob = value as unknown as CronJob;
			let status = 'unknown';

			try {
				// Determine status based on running property if available
				const jobWithRunning = cronJob as unknown as {
					running?: boolean;
				};
				status = jobWithRunning.running ? 'running' : 'stopped';
			} catch (e) {
				// Fallback if running property is not accessible
			}

			result.push({
				name: key,
				nextDate: cronJob.nextDate().toJSDate(),
				status,
				lastDate: cronJob.lastDate() || null,
			});
		});

		return result;
	}

	async stopCronJob(name: string) {
		const job = this.schedulerRegistry.getCronJob(name);
		job.stop();
		this.logger.log(`Cron job ${name} stopped by admin`);
		return { name, status: 'stopped' };
	}

	async startCronJob(name: string) {
		const job = this.schedulerRegistry.getCronJob(name);
		job.start();
		this.logger.log(`Cron job ${name} started by admin`);
		return { name, status: 'running' };
	}

	async listQueues() {
		const queues = [
			{ name: 'chapter-scraping', queue: this.chapterScrapingQueue },
			{ name: 'book-update-queue', queue: this.bookUpdateQueue },
			{ name: 'cover-image-queue', queue: this.coverImageQueue },
			{ name: 'fix-chapter-queue', queue: this.fixChapterQueue },
		];

		const result = await Promise.all(
			queues.map(async (q) => {
				const isPaused = await q.queue.isPaused();
				const counts = await q.queue.getJobCounts();
				const autoPauseData = await this.getAutoPauseStatus(q.name);

				return {
					name: q.name,
					status: isPaused ? 'paused' : 'active',
					counts,
					autoPause: autoPauseData,
				};
			}),
		);

		return result;
	}

	private async getAutoPauseStatus(queueName: string) {
		const key = `autopause:counter:${queueName}`;
		const client = await this.chapterScrapingQueue.client;
		const count = await client.get(key);
		return {
			consecutiveFailures: count ? Number.parseInt(count) : 0,
			threshold: 5, // Poderia vir do config
		};
	}

	async resetAutoPauseCounter(queueName: string) {
		const key = `autopause:counter:${queueName}`;
		const client = await this.chapterScrapingQueue.client;
		await client.del(key);
		return { success: true };
	}

	async pauseQueue(name: string) {
		const queue = this.getQueueByName(name);
		await queue.pause();
		this.logger.log(`Queue ${name} paused by admin`);
		return { name, status: 'paused' };
	}

	async resumeQueue(name: string) {
		const queue = this.getQueueByName(name);
		await queue.resume();
		this.logger.log(`Queue ${name} resumed by admin`);
		return { name, status: 'active' };
	}

	private getQueueByName(name: string): Queue {
		switch (name) {
			case 'chapter-scraping':
				return this.chapterScrapingQueue;
			case 'book-update-queue':
				return this.bookUpdateQueue;
			case 'cover-image-queue':
				return this.coverImageQueue;
			case 'fix-chapter-queue':
				return this.fixChapterQueue;
			default:
				throw new Error(`Queue ${name} not found or not manageable`);
		}
	}
}
