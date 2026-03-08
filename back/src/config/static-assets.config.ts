import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';

export function configureStaticAssets(app: NestExpressApplication) {
	app.useStaticAssets(join(__dirname, '..', '..', 'data'), {
		prefix: '/data/',
		maxAge: '7d',
		setHeaders: (res, path) => {
			res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
			res.setHeader('X-Content-Type-Options', 'nosniff');
		},
		dotfiles: 'ignore',
	});
}
