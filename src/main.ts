import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './infrastructure/app-config/app-config.service';
import { configureBodyParser } from './infrastructure/http/config/body-parser.config';
import { configureCors } from './infrastructure/http/config/cors.config';
import { configureKafka } from './infrastructure/http/config/kafka.config';
import { configureStaticAssets } from './infrastructure/http/config/static-assets.config';
import { configureSwagger } from './infrastructure/http/config/swagger.config';
import { configureValidationPipe } from './infrastructure/http/config/validation-pipe.config';

async function bootstrap() {
	const logger = new NestLogger('Bootstrap');
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bufferLogs: true,
	});
	app.useLogger(app.get(Logger));
	const configService = app.get(AppConfigService);

	configureBodyParser(app);
	configureValidationPipe(app);

	configureCors(app, configService.allowedUrls);
	configureStaticAssets(app);

	app.enableShutdownHooks();
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	app.getHttpAdapter().getInstance().set('trust proxy', true);

	logger.log('Iniciando configuração do Kafka...');
	configureKafka(app, configService);

	logger.log('Disparando inicialização de todos os microserviços...');
	await app.startAllMicroservices();
	logger.log('Microserviços inicializados.');

	if (
		configService.nodeEnv === 'development' ||
		configService.enableSwagger
	) {
		configureSwagger(app);
	}

	await app.listen(configService.port);
	logger.log(`API rodando na porta: ${configService.port}`);
}

bootstrap().catch((err) => {
	console.error('Fatal error during bootstrap:', err);
	process.exit(1);
});
