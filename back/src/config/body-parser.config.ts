import { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';

const REQUEST_BODY_LIMIT = '1mb';

export function configureBodyParser(app: NestExpressApplication) {
	app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
	app.use(
		express.urlencoded({
			extended: true,
			limit: REQUEST_BODY_LIMIT,
		}),
	);
}
