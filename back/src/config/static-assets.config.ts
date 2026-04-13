import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Response } from 'express';

export function configureStaticAssets(app: NestExpressApplication) {
	app.useStaticAssets(join(__dirname, '..', '..', 'data'), {
		prefix: '/data/',
		maxAge: '365d',
		setHeaders: (res: Response) => {
			res.setHeader(
				'Cache-Control',
				'public, max-age=31536000, immutable',
			);
			res.setHeader('X-Content-Type-Options', 'nosniff');
		},
		dotfiles: 'ignore',
	});
}
