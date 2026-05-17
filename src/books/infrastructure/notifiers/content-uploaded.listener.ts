import { QueueTextProcessingDto } from '@books/application/dto/queue-text-processing.dto';
import { BookEvents } from '@books/domain/constants/events.constant';
import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';

@Injectable()
export class ContentUploadedListener {
	private readonly logger = new Logger(ContentUploadedListener.name);

	constructor(
		@InjectQueue('text-processing-queue')
		private readonly textProcessingQueue: Queue<QueueTextProcessingDto>,
	) {}

	@OnEvent(BookEvents.CONTENT_UPLOADED)
	async handleContentUploadedEvent(payload: {
		chapterId: string;
		bookId: string;
		format: ContentFormat;
	}) {
		this.logger.debug(
			`Received CONTENT_UPLOADED event for chapter ${payload.chapterId} (format: ${payload.format})`,
		);

		try {
			await this.textProcessingQueue.add('process-text', {
				entityId: payload.chapterId,
				source: 'CHAPTER',
				format: payload.format,
			});
			this.logger.log(
				`Job adicionado à fila text-processing-queue para o capítulo ${payload.chapterId}`,
			);
		} catch (error: unknown) {
			this.logger.error(
				`Erro ao adicionar job na fila para o capítulo ${payload.chapterId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
