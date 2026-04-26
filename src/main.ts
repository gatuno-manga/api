import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import cookieParser from 'cookie-parser';
import { AppConfigService } from './infrastructure/app-config/app-config.service';
import { AppModule } from './app.module';
import { configureBodyParser } from './infrastructure/http/config/body-parser.config';
import { configureCors } from './infrastructure/http/config/cors.config';
import { configureStaticAssets } from './infrastructure/http/config/static-assets.config';
import { configureSwagger } from './infrastructure/http/config/swagger.config';
import { configureValidationPipe } from './infrastructure/http/config/validation-pipe.config';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const configService = app.get(AppConfigService);

	configureBodyParser(app);
	configureValidationPipe(app);

	configureCors(app, configService.allowedUrls);

	app.enableShutdownHooks();
	app.use(cookieParser());
	app.setGlobalPrefix('api');

	// Configura o Microserviço Kafka para consumir eventos
	const kafkaLogger = new Logger('KafkaConsumer');
	app.connectMicroservice<MicroserviceOptions>({
		transport: Transport.KAFKA,
		options: {
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
			},
			producer: {
				createPartitioner: Partitioners.LegacyPartitioner,
				allowAutoTopicCreation: true,
			},
		},
	});

	await app.startAllMicroservices();

	if (configService.nodeEnv === 'development') {
		configureSwagger(app);
	}

	await app.listen(configService.port);
}

bootstrap();
