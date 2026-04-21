import { INestApplication, ValidationPipe } from '@nestjs/common';

export function configureValidationPipe(app: INestApplication) {
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);
}
