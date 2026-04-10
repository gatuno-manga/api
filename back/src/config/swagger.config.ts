import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';

export function configureSwagger(app: INestApplication) {
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
			SWAGGER_AUTH_SCHEME,
		)
		.addTag(
			'Authentication',
			'User authentication and authorization endpoints',
		)
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
		operationIdFactory: (controllerKey: string, methodKey: string) =>
			methodKey,
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
