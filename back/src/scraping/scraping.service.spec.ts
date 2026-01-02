import { Test, TestingModule } from '@nestjs/testing';
import { ScrapingService } from './scraping.service';
import { AppConfigService } from '../app-config/app-config.service';
import { FilesService } from '../files/files.service';
import { WebsiteService } from './website.service';
import { PlaywrightBrowserFactory } from './browser';
import { REDIS_CLIENT } from '../redis/redis.constants';

// Mock playwright
jest.mock('playwright-extra', () => ({
	chromium: {
		use: jest.fn(),
		launch: jest.fn().mockResolvedValue({
			isConnected: jest.fn().mockReturnValue(true),
			newContext: jest.fn().mockResolvedValue({
				setDefaultNavigationTimeout: jest.fn(),
				setDefaultTimeout: jest.fn(),
				newPage: jest.fn().mockResolvedValue({
					goto: jest.fn(),
					evaluate: jest.fn(),
					$$eval: jest.fn().mockResolvedValue([]),
					waitForFunction: jest.fn(),
					waitForTimeout: jest.fn(),
					addInitScript: jest.fn(),
					close: jest.fn(),
				}),
				close: jest.fn(),
			}),
			close: jest.fn(),
		}),
	},
}));

jest.mock('puppeteer-extra-plugin-stealth', () => jest.fn());

describe('ScrapingService', () => {
	let service: ScrapingService;

	const mockAppConfigService = {
		seleniumUrl: 'http://localhost:4444',
		playwright: {
			debugMode: false,
			slowMo: 0,
			wsEndpoint: '',
		},
	};

	const mockCompressorFactory = {
		compress: jest.fn().mockResolvedValue({
			buffer: Buffer.from('compressed'),
			extension: '.webp',
		}),
		getCompressor: jest.fn().mockReturnValue({
			getOutputExtension: jest.fn().mockReturnValue('.webp'),
		}),
		hasCompressor: jest.fn().mockReturnValue(true),
	};

	const mockFilesService = {
		saveBufferFile: jest.fn().mockResolvedValue('/path/to/saved/file.jpg'),
		savePreCompressedFile: jest
			.fn()
			.mockResolvedValue('/path/to/saved/file.webp'),
		saveBase64File: jest.fn().mockResolvedValue('/path/to/saved/file.jpg'),
		getCompressorFactory: jest.fn().mockReturnValue(mockCompressorFactory),
		getPublicPath: jest.fn(),
	};

	const mockWebsiteService = {
		getByUrl: jest.fn().mockResolvedValue(null),
	};

	const mockRedisClient = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		incr: jest.fn().mockResolvedValue(1),
		decr: jest.fn().mockResolvedValue(0),
		expire: jest.fn(),
		ttl: jest.fn(),
		exists: jest.fn(),
		pipeline: jest.fn().mockReturnValue({
			incr: jest.fn().mockReturnThis(),
			expire: jest.fn().mockReturnThis(),
			exec: jest.fn().mockResolvedValue([[null, 1]]),
		}),
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
				{
					provide: REDIS_CLIENT,
					useValue: mockRedisClient,
				},
			],
		}).compile();

		service = module.get<ScrapingService>(ScrapingService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have logger initialized', () => {
		expect(service['logger']).toBeDefined();
	});

	it('should have browser factory initialized', () => {
		expect(service['browserFactory']).toBeDefined();
		expect(service['browserFactory']).toBeInstanceOf(
			PlaywrightBrowserFactory,
		);
	});

	it('should have concurrency manager initialized', () => {
		expect(service['concurrencyManager']).toBeDefined();
	});

	describe('setConcurrencyManager', () => {
		it('should replace the concurrency manager', () => {
			const mockManager = {
				acquire: jest.fn(),
				release: jest.fn(),
			};

			service.setConcurrencyManager(mockManager);
			expect(service['concurrencyManager']).toBe(mockManager);
		});
	});

	describe('setBrowserFactory', () => {
		it('should replace the browser factory', () => {
			const mockFactory = new PlaywrightBrowserFactory({
				headless: true,
			});

			service.setBrowserFactory(mockFactory);
			expect(service['browserFactory']).toBe(mockFactory);
		});
	});

	describe('getWebsiteConfig', () => {
		it('should return default config when website not found', async () => {
			mockWebsiteService.getByUrl.mockResolvedValue(null);

			const config = await service['getWebsiteConfig'](
				'https://example.com',
			);

			expect(config).toEqual({
				selector: 'img',
				preScript: '',
				posScript: '',
				concurrencyLimit: null,
				blacklistTerms: [],
				whitelistTerms: [],
				useNetworkInterception: true,
				useScreenshotMode: false,
				bookInfoExtractScript: undefined,
				chapterListSelector: undefined,
				cookies: undefined,
				localStorage: undefined,
				sessionStorage: undefined,
				reloadAfterStorageInjection: undefined,
				enableAdaptiveTimeouts: true,
				timeoutMultipliers: undefined,
			});
		});

		it('should return website config when found', async () => {
			mockWebsiteService.getByUrl.mockResolvedValue({
				selector: '.custom-img',
				preScript: 'console.log("pre")',
				posScript: 'console.log("pos")',
				concurrencyLimit: 5,
				blacklistTerms: ['logo', 'icon'],
				whitelistTerms: ['cdn.example.com'],
				useNetworkInterception: true,
				useScreenshotMode: false,
			});

			const config = await service['getWebsiteConfig'](
				'https://example.com',
			);

			expect(config).toEqual({
				selector: '.custom-img',
				preScript: 'console.log("pre")',
				posScript: 'console.log("pos")',
				concurrencyLimit: 5,
				blacklistTerms: ['logo', 'icon'],
				whitelistTerms: ['cdn.example.com'],
				useNetworkInterception: true,
				useScreenshotMode: false,
				bookInfoExtractScript: undefined,
				chapterListSelector: undefined,
				cookies: undefined,
				localStorage: undefined,
				sessionStorage: undefined,
				reloadAfterStorageInjection: false,
				enableAdaptiveTimeouts: true,
				timeoutMultipliers: undefined,
			});
		});

		it('should return config with network interception disabled', async () => {
			mockWebsiteService.getByUrl.mockResolvedValue({
				selector: 'img',
				useNetworkInterception: false,
				blacklistTerms: null,
				whitelistTerms: null,
			});

			const config = await service['getWebsiteConfig'](
				'https://example.com',
			);

			expect(config.useNetworkInterception).toBe(false);
			expect(config.blacklistTerms).toEqual([]);
			expect(config.whitelistTerms).toEqual([]);
		});

		it('should return config with screenshot mode enabled', async () => {
			mockWebsiteService.getByUrl.mockResolvedValue({
				selector: 'canvas.page',
				useScreenshotMode: true,
			});

			const config = await service['getWebsiteConfig'](
				'https://example.com',
			);

			expect(config.useScreenshotMode).toBe(true);
			expect(config.selector).toBe('canvas.page');
		});
	});

	describe('onApplicationShutdown', () => {
		it('should close browser on shutdown', async () => {
			// Simulate browser being active
			const mockBrowser = {
				close: jest.fn().mockResolvedValue(undefined),
				isConnected: jest.fn().mockReturnValue(true),
			};
			service['browser'] =
				mockBrowser as unknown as (typeof service)['browser'];

			await service.onApplicationShutdown();

			expect(mockBrowser.close).toHaveBeenCalled();
			expect(service['browser']).toBeNull();
		});

		it('should handle null browser gracefully', async () => {
			service['browser'] = null;

			await expect(
				service.onApplicationShutdown(),
			).resolves.not.toThrow();
		});
	});
});
