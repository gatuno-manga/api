import { CustomTransportStrategy, ServerKafka } from '@nestjs/microservices';
import { Consumer, KafkaMessage } from 'kafkajs';

export class KafkaBatchStrategy
	extends ServerKafka
	implements CustomTransportStrategy
{
	async bindEvents(consumer: Consumer) {
		const registeredPatterns = [...this.messageHandlers.keys()];
		const consumerSubscribeOptions = this.options?.subscribe || {};

		for (const pattern of registeredPatterns) {
			await consumer.subscribe({
				...consumerSubscribeOptions,
				topic: pattern,
			});
		}

		await consumer.run({
			...this.options?.run,
			eachBatch: async ({
				batch,
				resolveOffset,
				heartbeat,
				commitOffsetsIfNecessary,
			}) => {
				const pattern = batch.topic;
				const handler = this.getHandlerByPattern(pattern);

				if (!handler) {
					return;
				}

				try {
					// Passamos as mensagens originais (KafkaMessage[]) para o controller
					await handler(batch.messages, {
						batch,
						resolveOffset,
						heartbeat,
						commitOffsetsIfNecessary,
					});
				} catch (error) {
					this.logger.error(
						`Error processing batch for topic ${pattern}: ${error.message}`,
						error.stack,
					);
					// Em caso de erro no lote, o KafkaJS lida com a retentativa
					// se não resolvermos os offsets aqui.
					throw error;
				}
			},
		});
	}
}
