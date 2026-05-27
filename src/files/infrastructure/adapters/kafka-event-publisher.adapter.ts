import { AppConfigService } from '@app-config/app-config.service';
import {
	EventPublisherPort,
	ImageProcessingRequestEvent,
} from '@files/application/ports/event-publisher.port';
import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class KafkaEventPublisherAdapter
	implements EventPublisherPort, OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(KafkaEventPublisherAdapter.name);
	private readonly client: ClientKafka;

	constructor(private readonly configService: AppConfigService) {
		this.client = new ClientKafka({
			client: {
				clientId: 'gatuno-api-publisher',
				brokers: [this.configService.kafkaBroker],
				retry: {
					initialRetryTime: 1000,
					retries: 10,
					maxRetryTime: 30000,
				},
				connectionTimeout: 10000,
				authenticationTimeout: 10000,
			},
			producer: {
				createPartitioner: Partitioners.LegacyPartitioner,
				allowAutoTopicCreation: true,
			},
		});
	}

	onModuleInit() {
		// Conecta em background para não bloquear o bootstrap da API
		this.client.connect().catch((error) => {
			this.logger.error(
				`[KafkaEventPublisherAdapter] Falha ao conectar ao Kafka em background: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
	}

	async onModuleDestroy() {
		await this.client.close();
	}

	async publishImageProcessingRequest(
		event: ImageProcessingRequestEvent,
	): Promise<void> {
		try {
			await lastValueFrom(
				this.client.emit('image.processing.requested', event),
			);
			this.logger.log(
				`Evento de processamento de imagem publicado: ${event.rawPath}`,
			);
		} catch (error: unknown) {
			this.logger.error(
				`Erro ao publicar evento no Kafka para ${event.rawPath}: ${error instanceof Error ? error.message : String(error)}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}
