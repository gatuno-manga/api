import { Logger } from '@nestjs/common';
import { CustomTransportStrategy, ServerKafka } from '@nestjs/microservices';
import { Consumer, Kafka } from 'kafkajs';

export class KafkaBatchStrategy
	extends ServerKafka
	implements CustomTransportStrategy
{
	protected override readonly logger = new Logger(KafkaBatchStrategy.name);

	override async bindEvents(consumer: Consumer) {
		const registeredPatterns = [...this.messageHandlers.keys()];
		const consumerSubscribeOptions = this.options?.subscribe || {};

		this.logger.log(
			`[KafkaBatchStrategy] Iniciando bindEvents Kafka. Padrões registrados no NestJS: ${registeredPatterns.length}`,
		);

		if (registeredPatterns.length === 0) {
			this.logger.warn(
				'[KafkaBatchStrategy] NENHUM pattern (@EventPattern/@MessagePattern) foi registrado! Verifique se os controllers estão no módulo correto.',
			);
			return;
		}

		this.logger.log(
			`[KafkaBatchStrategy] Padrões detectados: ${registeredPatterns.join(', ')}`,
		);

		// Garantir que os tópicos existam antes de assinar para não ocorrer erro de tópico inexistente
		await this.ensureTopicsExist(registeredPatterns);

		for (const pattern of registeredPatterns) {
			this.logger.log(
				`[KafkaBatchStrategy] Subscrevendo ao tópico: ${pattern}`,
			);
			await consumer.subscribe({
				...consumerSubscribeOptions,
				topic: pattern,
				fromBeginning: true,
			});
		}

		this.logger.log(
			'[KafkaBatchStrategy] Kafka Consumer iniciando loop (run) em background...',
		);

		// Executa o run em background para não bloquear o startup do NestJS
		consumer
			.run({
				...this.options?.run,
				eachBatch: async (batchData) => {
					const topic = batchData.batch.topic;

					// Tenta buscar o handler pelo nome do tópico
					let handler = this.getHandlerByPattern(topic);

					if (!handler) {
						// Fallback: tenta buscar por pattern stringificado (padrão NestJS para alguns transports)
						const stringifiedPattern = JSON.stringify({
							pattern: topic,
						});
						handler = this.getHandlerByPattern(stringifiedPattern);
					}

					this.logger.debug(
						`[KafkaBatchStrategy] Recebido lote de ${batchData.batch.messages.length} mensagens para o tópico: ${topic}`,
					);

					if (!handler) {
						this.logger.warn(
							`[KafkaBatchStrategy] Nenhum handler encontrado para o tópico: ${topic}`,
						);
						return;
					}

					try {
						// Chamada do handler com as mensagens e contexto adicional
						// Envolvemos as funções em arrow functions acessando via objeto pai para evitar o erro 'unbound-method'
						await handler(batchData.batch.messages, {
							batch: batchData.batch,
							resolveOffset: (offset: string) =>
								batchData.resolveOffset(offset),
							heartbeat: () => batchData.heartbeat(),
							commitOffsetsIfNecessary: () =>
								batchData.commitOffsetsIfNecessary(),
							topic,
							partition: batchData.batch.partition,
						});
					} catch (error: unknown) {
						this.logger.error(
							`[KafkaBatchStrategy] Erro ao processar lote no tópico ${topic}: ${error instanceof Error ? error.message : String(error)}`,
							error instanceof Error ? error.stack : undefined,
						);
						throw error;
					}
				},
			})
			.catch((error) => {
				this.logger.error(
					`[KafkaBatchStrategy] Erro fatal no loop do consumidor Kafka: ${error instanceof Error ? error.message : String(error)}`,
					error instanceof Error ? error.stack : undefined,
				);
			});
	}

	private async ensureTopicsExist(topics: string[]) {
		const client = (this as unknown as { client: Kafka }).client;
		if (!client) {
			this.logger.warn(
				'[KafkaBatchStrategy] Cliente Kafka não inicializado na base ServerKafka.',
			);
			return;
		}

		const admin = client.admin();
		try {
			await admin.connect();
			const existingTopics = await admin.listTopics();
			const topicsToCreate = topics.filter(
				(topic) => !existingTopics.includes(topic),
			);

			if (topicsToCreate.length > 0) {
				this.logger.log(
					`[KafkaBatchStrategy] Criando tópicos faltantes: ${topicsToCreate.join(', ')}`,
				);
				await admin.createTopics({
					topics: topicsToCreate.map((topic) => ({
						topic,
						numPartitions: 1,
						replicationFactor: 1,
					})),
				});
			}
		} catch (error: unknown) {
			this.logger.error(
				`[KafkaBatchStrategy] Erro ao verificar/criar tópicos: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			await admin.disconnect();
		}
	}
}
