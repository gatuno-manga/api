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
	app.enableShutdownHooks();
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	app.useStaticAssets(join(__dirname, '..', 'data'), {
		prefix: '/data/',
		maxAge: '7d',
		setHeaders: (res, path) => {
			res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
			res.setHeader('X-Content-Type-Options', 'nosniff');
		},
		dotfiles: 'ignore',
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
	app.enableCors({
		origin: process.env.ALLOWED_URL?.split(',') || ['http://localhost:4200'],
		credentials: true,
	});
}
bootstrap();
