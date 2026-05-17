import { ImageProcessingCompletedEvent } from '@files/application/strategies/image-update/image-update.strategy';
import { HandleImageProcessingCompletedUseCase } from '@files/application/use-cases/handle-image-processing-completed.use-case';
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KafkaMessage } from 'kafkajs';

@Controller()
export class ImageProcessingController {
	private readonly logger = new Logger(ImageProcessingController.name);

	constructor(
		private readonly handleImageProcessingCompletedUseCase: HandleImageProcessingCompletedUseCase,
	) {}

	@EventPattern('image.processing.completed')
	async handleImageProcessingCompleted(@Payload() messages: KafkaMessage[]) {
		this.logger.log(
			`Recebido lote de ${messages.length} mensagens Kafka...`,
		);

		const events: ImageProcessingCompletedEvent[] = messages
			.map((message) => {
				try {
					if (!message.value) return null;
					return JSON.parse(
						message.value.toString(),
					) as ImageProcessingCompletedEvent;
				} catch (error: unknown) {
					this.logger.error(
						`Erro ao desserializar mensagem Kafka: ${error instanceof Error ? error.message : String(error)}`,
					);
					return null;
				}
			})
			.filter(
				(event): event is ImageProcessingCompletedEvent =>
					event !== null,
			);

		if (events.length === 0) return;

		try {
			await this.handleImageProcessingCompletedUseCase.executeBatch(
				events,
			);
			this.logger.log(
				`Sucesso ao processar lote de ${events.length} imagens.`,
			);
		} catch (error: unknown) {
			this.logger.error(
				`Erro ao processar lote de imagens: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
			// Lançamos o erro para que a estratégia customizada (KafkaBatchStrategy)
			// possa lidar com a falha do lote (retentativa nativa do Kafka).
			throw error;
		}
	}
}
