import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	configPipe(app);
	configureCors(app);
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	app.useStaticAssets(join(__dirname, '..', 'data'), {
		prefix: '/data/',
	});
	await app.listen(process.env.PORT ?? 3000);
}

function configPipe(app: INestApplication) {
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);
}

function configureCors(app: INestApplication) {
	app.enableCors();
}
bootstrap();
