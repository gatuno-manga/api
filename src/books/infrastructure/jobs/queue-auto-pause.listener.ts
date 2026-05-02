import {
	OnWorkerEvent,
	Processor,
	WorkerHost,
	getQueueToken,
} from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { ModuleRef } from '@nestjs/core';
import { REDIS_CLIENT } from 'src/infrastructure/redis/redis.constants';
import { Redis } from 'ioredis';

/**
 * Global listener to implement Auto-Pause (Circuit Breaker) logic for queues.
 * If specific error patterns (403/429) occur consecutively, the queue is paused.
 */
@Injectable()
@Processor('*') // Listens to all workers in this process
export class QueueAutoPauseListener extends WorkerHost {
	private readonly logger = new Logger(QueueAutoPauseListener.name);
	private readonly FAILURE_THRESHOLD = 5;
	private readonly BLOCK_ERRORS = [
		'403',
		'429',
		'forbidden',
		'too many requests',
		'blocked',
	];

	constructor(
		private readonly moduleRef: ModuleRef,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {
		super();
	}

	// This is a global listener, we don't process jobs here,
	// but WorkerHost requires this implementation or we use @OnWorkerEvent
	async process(): Promise<void> {}

	@OnWorkerEvent('failed')
	async onFailed(job: Job, error: Error) {
		const queueName = job.queueName;
		const errorMessage = error.message.toLowerCase();

		const isBlockError = this.BLOCK_ERRORS.some((term) =>
			errorMessage.includes(term),
		);

		if (!isBlockError) {
			return;
		}

		this.logger.warn(
			`Potential IP block detected on queue ${queueName}: ${error.message}`,
		);

		const counterKey = `autopause:counter:${queueName}`;

		const currentFailures = await this.redis.incr(counterKey);

		if (currentFailures >= this.FAILURE_THRESHOLD) {
			this.logger.error(
				`CRITICAL: Queue ${queueName} reached failure threshold (${this.FAILURE_THRESHOLD}). AUTO-PAUSING.`,
			);

			try {
				// Pause the queue
				const queue = this.moduleRef.get<Queue>(
					getQueueToken(queueName),
					{
						strict: false,
					},
				);
				await queue.pause();

				// Set an expiration for the counter so it resets eventually if not cleared manually
				await this.redis.expire(counterKey, 3600); // 1 hour

				this.logger.log(
					`Queue ${queueName} successfully auto-paused for protection.`,
				);
			} catch (pauseError) {
				this.logger.error(
					`Failed to auto-pause queue ${queueName}: ${pauseError.message}`,
				);
			}
		}
	}

	@OnWorkerEvent('completed')
	async onCompleted(job: Job) {
		// Successful job, reset the counter for this queue
		const queueName = job.queueName;
		const counterKey = `autopause:counter:${queueName}`;
		await this.redis.del(counterKey);
	}
}
