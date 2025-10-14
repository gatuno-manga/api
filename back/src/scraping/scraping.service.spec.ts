import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingService } from './scraping.service';
import { AppConfigService } from '../app-config/app-config.service';
import { FilesService } from '../files/files.service';
import { WebsiteService } from './website.service';

describe('ScrapingService', () => {
	let service: ScrapingService;

	const mockAppConfigService = {
		downloadDir: '/tmp/test',
		chromeDriverPath: '/usr/bin/chromedriver',
	};

	const mockFilesService = {
		saveBase64File: jest.fn(),
		getPublicPath: jest.fn(),
	};

	const mockWebsiteService = {
		findOne: jest.fn(),
		findAll: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ScrapingService,
				{
					provide: AppConfigService,
					useValue: mockAppConfigService,
				},
				{
					provide: FilesService,
					useValue: mockFilesService,
				},
				{
					provide: WebsiteService,
					useValue: mockWebsiteService,
				},
			],
		}).compile();

		service = module.get<ScrapingService>(ScrapingService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have logger initialized', () => {
		expect(service['logger']).toBeDefined();
	});
});
