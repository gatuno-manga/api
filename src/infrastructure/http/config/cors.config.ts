import { INestApplication } from '@nestjs/common';

export function configureCors(app: INestApplication, allowedUrls: string[]) {
	app.enableCors({
		origin: allowedUrls,
		credentials: true,
	});
}
