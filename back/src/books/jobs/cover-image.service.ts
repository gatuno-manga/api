import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UrlImageDto } from '../dto/url-image.dto';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Injectable()
export class CoverImageService {
	private readonly logger = new Logger(CoverImageService.name);

	constructor(
		@InjectQueue(QUEUE_NAME)
		private readonly coverImageQueue: Queue<QueueCoverProcessorDto>,
	) {}

	/**
	 * Adiciona um job de capa à fila.
	 * Usa jobId único com timestamp para permitir reprocessamento.
	 */
	public async addCoverToQueue(
		bookId: string,
		urlOrigin: string,
		covers: UrlImageDto[],
	): Promise<void> {
		const jobId = `cover-image-${bookId}-${Date.now()}`;

		try {
			await this.coverImageQueue.add(
				JOB_NAME,
				{ bookId, urlOrigin, covers },
				{ jobId },
			);
			this.logger.debug(
				`Adicionando job de capa (batch) para o livro: ${bookId}`,
			);
		} catch (error) {
			// Job com mesmo ID já existe na fila (muito raro com timestamp)
			if (error.message?.includes('Job with this id already exists')) {
				this.logger.debug(
					`Job de capa para o livro ${bookId} já está na fila.`,
				);
			} else {
				throw error;
			}
		}
	}
}
