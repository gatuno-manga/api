import { INestApplication } from '@nestjs/common';
import { MicroserviceOptions } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { AppConfigService } from '../../app-config/app-config.service';
import { KafkaBatchStrategy } from './kafka-batch.strategy';

export function configureKafka(
	app: INestApplication,
	configService: AppConfigService,
) {
	app.connectMicroservice<MicroserviceOptions>({
		strategy: new KafkaBatchStrategy({
			client: {
				clientId: 'gatuno-api-consumer',
				brokers: [configService.kafkaBroker],
				retry: {
					initialRetryTime: 1000,
					retries: 10,
					maxRetryTime: 30000,
				},
				connectionTimeout: 10000,
				authenticationTimeout: 10000,
			},
			consumer: {
				groupId: 'gatuno-api-group',
				allowAutoTopicCreation: true,
				metadataMaxAge: 3000,
				sessionTimeout: 60000,
				heartbeatInterval: 3000,
				maxBytesPerPartition: 1048576, // 1MB por partição
				maxBytes: 5242880, // 5MB no total por lote
			},
			run: {
				autoCommit: true,
				autoCommitInterval: 5000,
				partitionsConsumedConcurrently: 5,
			},
			producer: {
				createPartitioner: Partitioners.LegacyPartitioner,
				allowAutoTopicCreation: true,
			},
		}),
	});
}
