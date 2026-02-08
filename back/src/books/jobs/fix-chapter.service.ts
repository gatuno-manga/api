import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'fix-chapter-queue';
const JOB_NAME = 'fix-chapter';

@Injectable()
export class FixChapterService {
	private readonly logger = new Logger(FixChapterService.name);

	constructor(
		@InjectQueue(QUEUE_NAME)
		private readonly fixChapterQueue: Queue<{ chapterId: string }>,
	) {}

	/**
	 * Adiciona um capítulo à fila de conserto.
	 * Usa jobId único para deduplicação eficiente O(1).
	 */
	public async addChapterToFixQueue(chapterId: string): Promise<void> {
		const jobId = `fix-chapter-${chapterId}`;

		try {
			await this.fixChapterQueue.add(JOB_NAME, { chapterId }, { jobId });
			this.logger.debug(
				`Adicionando job de conserto para o capítulo: ${chapterId}`,
			);
		} catch (error) {
			// Job com mesmo ID já existe na fila
			if (error.message?.includes('Job with this id already exists')) {
				this.logger.debug(
					`Job de conserto para o capítulo ${chapterId} já está na fila.`,
				);
			} else {
				throw error;
			}
		}
	}
}
