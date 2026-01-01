import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'book-update-queue';
const JOB_NAME = 'update-book';

@Injectable()
export class BookUpdateJobService {
	private readonly logger = new Logger(BookUpdateJobService.name);

	constructor(
		@InjectQueue(QUEUE_NAME)
		private readonly bookUpdateQueue: Queue<{ bookId: string }>,
	) {}

	/**
	 * Adiciona um livro à fila de atualização.
	 * Remove job anterior (se existir) para permitir re-execução.
	 */
	async addBookToUpdateQueue(bookId: string): Promise<void> {
		const jobId = `book-update-${bookId}`;

		try {
			// Remove job anterior se existir (para permitir re-execução)
			const existingJob = await this.bookUpdateQueue.getJob(jobId);
			if (existingJob) {
				const state = await existingJob.getState();
				// Remove apenas se já foi processado (completed, failed) ou está parado (stalled)
				if (['completed', 'failed'].includes(state)) {
					await existingJob.remove();
					this.logger.debug(
						`Removed previous job for book ${bookId} (state: ${state})`,
					);
				} else if (
					state === 'active' ||
					state === 'waiting' ||
					state === 'delayed'
				) {
					this.logger.debug(
						`Book ${bookId} already has a pending job (state: ${state})`,
					);
					return;
				}
			}

			await this.bookUpdateQueue.add(JOB_NAME, { bookId }, { jobId });
			this.logger.debug(`Book ${bookId} added to update queue`);
		} catch (error) {
			this.logger.error(
				`Error adding book ${bookId} to queue: ${error.message}`,
			);
			throw error;
		}
	}

	/**
	 * Adiciona múltiplos livros à fila de atualização
	 */
	async addBooksToUpdateQueue(bookIds: string[]): Promise<void> {
		for (const bookId of bookIds) {
			await this.addBookToUpdateQueue(bookId);
		}
		this.logger.log(`Added ${bookIds.length} books to update queue`);
	}
}
