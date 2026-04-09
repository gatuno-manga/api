import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppConfigService } from './app-config/app-config.service';
import { AppModule } from './app.module';
import { configureBodyParser } from './config/body-parser.config';
import { configureCors } from './config/cors.config';
import { configureStaticAssets } from './config/static-assets.config';
import { configureSwagger } from './config/swagger.config';
import { configureValidationPipe } from './config/validation-pipe.config';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	const configService = app.get(AppConfigService);

	configureBodyParser(app);
	configureValidationPipe(app);

	configureCors(app, configService.allowedUrls);

	app.enableShutdownHooks();
	app.use(cookieParser());
	app.setGlobalPrefix('api');

	if (configService.nodeEnv === 'development') {
		configureSwagger(app);
	}

	configureStaticAssets(app);

	await app.listen(configService.port);
}

bootstrap();
