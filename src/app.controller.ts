import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';
import { AppConfigService } from './infrastructure/app-config/app-config.service';

@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly configService: AppConfigService,
	) {}

	@Get()
	getHello() {
		return this.appService.getHello();
	}

	@Get('.well-known/assetlinks.json')
	@Header('Content-Type', 'application/json')
	getAssetLinks() {
		const { packageName, sha256Fingerprints } = this.configService.android;

		return [
			{
				relation: ['delegate_permission/common.get_login_creds'],
				target: {
					namespace: 'android_app',
					package_name: packageName,
					sha256_cert_fingerprints: sha256Fingerprints,
				},
			},
		];
	}
}
