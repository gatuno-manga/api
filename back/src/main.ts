import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	configPipe(app);
	configureCors(app);
	app.enableShutdownHooks();
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	if (process.env.NODE_ENV === 'development') configureSwagger(app);
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

function configureSwagger(app: INestApplication) {
	const config = new DocumentBuilder()
		.setTitle('Gatuno API')
		.setDescription('API para biblioteca gatuno')
		.setVersion('0.5.6')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				name: 'JWT',
				description: 'Enter JWT token',
				in: 'header',
			},
			'JWT-auth',
		)
		.addTag('Authentication', 'User authentication and authorization endpoints')
		.addTag('Users', 'User profile management')
		.addTag('Collections', 'User book collections management')
		.addTag('Books', 'Public book browsing and reading')
		.addTag('Books Admin', 'Administrative book management (Admin only)')
		.addTag('Chapters', 'Chapter reading and management')
		.addTag('Authors', 'Author information and management')
		.addTag('Tags', 'Book tags and categories')
		.addTag('Sensitive Content', 'Content warnings and ratings')
		.addTag('Website Scraping', 'Website scraping configuration')
		.build();
	const document = SwaggerModule.createDocument(app, config, {
		operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
	});
	SwaggerModule.setup('docs', app, document, {
		swaggerOptions: {
			persistAuthorization: true,
			tagsSorter: 'alpha',
			operationsSorter: 'alpha',
			docExpansion: 'none',
			filter: true,
			tryItOutEnabled: true,
		},
		customCss: '.swagger-ui .topbar { display: none }',
		customSiteTitle: 'Gatuno API Documentation',
	});
}
bootstrap();
