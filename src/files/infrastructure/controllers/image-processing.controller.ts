import { Controller, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { HandleImageProcessingCompletedUseCase } from '../../application/use-cases/handle-image-processing-completed.use-case';
import { ImageProcessingCompletedEvent } from '../../application/strategies/image-update/image-update.strategy';

interface PendingEvent {
	event: ImageProcessingCompletedEvent;
	resolve: () => void;
	reject: (error: unknown) => void;
}

@Controller()
export class ImageProcessingController implements OnModuleDestroy {
	private readonly logger = new Logger(ImageProcessingController.name);
	private pendingEvents: PendingEvent[] = [];
	private flushTimer: NodeJS.Timeout | null = null;
	private readonly BATCH_SIZE = 50;
	private readonly BATCH_INTERVAL = 500; // ms

	constructor(
		private readonly handleImageProcessingCompletedUseCase: HandleImageProcessingCompletedUseCase,
	) {}

	@EventPattern('image.processing.completed')
	async handleImageProcessingCompleted(
		@Payload() data: ImageProcessingCompletedEvent,
	) {
		return new Promise<void>((resolve, reject) => {
			this.pendingEvents.push({ event: data, resolve, reject });

			if (this.pendingEvents.length >= this.BATCH_SIZE) {
				this.flush();
			} else if (!this.flushTimer) {
				this.flushTimer = setTimeout(
					() => this.flush(),
					this.BATCH_INTERVAL,
				);
			}
		});
	}

	private async flush() {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.pendingEvents.length === 0) return;

		const batchToProcess = [...this.pendingEvents];
		this.pendingEvents = [];

		const events = batchToProcess.map((p) => p.event);

		this.logger.log(
			`Processando bloco de ${events.length} eventos Kafka...`,
		);

		try {
			await this.handleImageProcessingCompletedUseCase.executeBatch(
				events,
			);
			for (const pending of batchToProcess) {
				pending.resolve();
			}
		} catch (error) {
			this.logger.error(
				`Erro ao processar bloco de imagens: ${error.message}`,
				error.stack,
			);
			for (const pending of batchToProcess) {
				pending.reject(error);
			}
		}
	}

	onModuleDestroy() {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
		}
		// Tenta processar o que restou antes de desligar
		if (this.pendingEvents.length > 0) {
			this.flush();
		}
	}
}
