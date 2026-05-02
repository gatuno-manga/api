import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigService } from './infrastructure/app-config/app-config.service';

describe('AppController', () => {
	let appController: AppController;
	let configService: AppConfigService;

	beforeEach(async () => {
		const app: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [
				AppService,
				{
					provide: AppConfigService,
					useValue: {
						android: {
							packageName: 'com.gatuno.app',
							sha256Fingerprints: ['00:11:22'],
						},
					},
				},
			],
		}).compile();

		appController = app.get<AppController>(AppController);
		configService = app.get<AppConfigService>(AppConfigService);
	});

	describe('root', () => {
		it('should return welcome message with API info', () => {
			const result = appController.getHello();
			expect(result).toEqual({
				message: 'Welcome to Gatuno API',
				documentation: '/docs',
			});
		});

		it('should have message property', () => {
			const result = appController.getHello();
			expect(result).toHaveProperty('message');
		});

		it('should have documentation property', () => {
			const result = appController.getHello();
			expect(result).toHaveProperty('documentation');
		});
	});

	describe('getAssetLinks', () => {
		it('should return asset links for android passkeys', () => {
			const result = appController.getAssetLinks();
			expect(result).toBeInstanceOf(Array);
			expect(result[0]).toMatchObject({
				relation: ['delegate_permission/common.get_login_creds'],
				target: {
					namespace: 'android_app',
					package_name: 'com.gatuno.app',
				},
			});
			expect(result[0].target.sha256_cert_fingerprints).toBeDefined();
		});
	});
});
