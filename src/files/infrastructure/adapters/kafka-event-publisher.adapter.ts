import {
	Injectable,
	Logger,
	OnModuleInit,
	OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientKafka } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { lastValueFrom } from 'rxjs';
import {
	EventPublisherPort,
	ImageProcessingRequestEvent,
} from '@files/application/ports/event-publisher.port';

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
				retry: {
					initialRetryTime: 1000,
					retries: 10,
					maxRetryTime: 30000,
				},
				connectionTimeout: 10000,
				authenticationTimeout: 10000,
			},
			consumer: {
				groupId: 'gatuno-api-publisher-group',
				allowAutoTopicCreation: true,
				metadataMaxAge: 3000,
			},
			producer: {
				createPartitioner: Partitioners.LegacyPartitioner,
				allowAutoTopicCreation: true,
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
			// Usamos lastValueFrom para aguardar a emissão e garantir backpressure
			await lastValueFrom(
				this.client.emit(
					'image.processing.requested',
					JSON.stringify(event),
				),
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
