import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
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

	if (configService.nodeEnv === 'development') {
		configureSwagger(app);
	}

	await app.listen(configService.port);
}

bootstrap();
