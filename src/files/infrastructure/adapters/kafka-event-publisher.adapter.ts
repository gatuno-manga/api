import {
	Injectable,
	Logger,
	OnModuleInit,
	OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import {
	EventPublisherPort,
	ImageProcessingRequestEvent,
} from '../../application/ports/event-publisher.port';

@Injectable()
export class KafkaEventPublisherAdapter
	implements EventPublisherPort, OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(KafkaEventPublisherAdapter.name);
	private readonly client: ClientKafka;

	constructor(private readonly configService: ConfigService) {
		this.client = new ClientKafka({
			client: {
				clientId: 'gatuno-api-publisher',
				brokers: [
					this.configService.get<string>(
						'KAFKA_BROKER',
						'kafka:9092',
					),
				],
			},
			consumer: {
				groupId: 'gatuno-api-group',
			},
			producer: {
				createPartitioner: Partitioners.LegacyPartitioner,
			},
		});
	}

	async onModuleInit() {
		await this.client.connect();
	}

	async onModuleDestroy() {
		await this.client.close();
	}

	async publishImageProcessingRequest(
		event: ImageProcessingRequestEvent,
	): Promise<void> {
		try {
			// Usamos emit para eventos Fire and Forget (Async)
			this.client.emit(
				'image.processing.requested',
				JSON.stringify(event),
			);
			this.logger.log(
				`Evento de processamento de imagem publicado: ${event.rawPath}`,
			);
		} catch (error) {
			this.logger.error('Erro ao publicar evento no Kafka', error);
			throw error;
		}
	}
}
