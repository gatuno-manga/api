import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
	let appController: AppController;

	beforeEach(async () => {
		const app: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [AppService],
		}).compile();

		appController = app.get<AppController>(AppController);
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
});
