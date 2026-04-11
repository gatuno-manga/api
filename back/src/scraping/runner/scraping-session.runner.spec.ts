import { PlaywrightBrowserFactory } from '../browser';
import { IConcurrencyManager } from '../concurrency';
import { WebsiteConfigDto } from '../dto/website-config.dto';
import { NetworkInterceptor } from '../helpers';
import { ScrapingSessionRunner } from './scraping-session.runner';

describe('ScrapingSessionRunner', () => {
	let runner: ScrapingSessionRunner;

	let mockBrowserFactory: jest.Mocked<PlaywrightBrowserFactory>;
	let mockConcurrencyManager: jest.Mocked<IConcurrencyManager>;

	let mockBrowser: any;
	let mockContext: any;
	let mockPage: any;

	const baseConfig = (
		overrides: Partial<WebsiteConfigDto> = {},
	): WebsiteConfigDto => ({
		selector: 'img',
		preScript: '',
		posScript: '',
		concurrencyLimit: 2,
		blacklistTerms: [],
		whitelistTerms: [],
		useNetworkInterception: false,
		useScreenshotMode: false,
		...overrides,
	});

	beforeEach(() => {
		mockBrowser = {};
		mockContext = {
			close: jest.fn().mockResolvedValue(undefined),
		};
		mockPage = {
			goto: jest.fn().mockResolvedValue(undefined),
			waitForFunction: jest.fn().mockResolvedValue(undefined),
			waitForLoadState: jest.fn().mockResolvedValue(undefined),
			reload: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			on: jest.fn(),
			off: jest.fn(),
			evaluate: jest.fn().mockResolvedValue(undefined),
		};

		mockBrowserFactory = {
			launch: jest.fn().mockResolvedValue(mockBrowser),
			createContext: jest.fn().mockResolvedValue(mockContext),
			createPage: jest.fn().mockResolvedValue(mockPage),
			release: jest.fn().mockResolvedValue(undefined),
			setBrowserPool: jest.fn(),
			shutdown: jest.fn().mockResolvedValue(undefined),
		} as unknown as jest.Mocked<PlaywrightBrowserFactory>;

		mockConcurrencyManager = {
			acquire: jest.fn().mockResolvedValue(undefined),
			release: jest.fn(),
		} as unknown as jest.Mocked<IConcurrencyManager>;

		runner = new ScrapingSessionRunner(
			mockBrowserFactory,
			mockConcurrencyManager,
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('runs task successfully and always releases browser resources', async () => {
		const result = await runner.run(
			'https://example.com/chapter-1',
			baseConfig(),
			async ({ page }) => {
				expect(page).toBe(mockPage);
				return 'ok';
			},
		);

		expect(result).toBe('ok');
		expect(mockConcurrencyManager.acquire).toHaveBeenCalledWith(
			'example.com',
			2,
		);
		expect(mockPage.close).toHaveBeenCalled();
		expect(mockContext.close).toHaveBeenCalled();
		expect(mockBrowserFactory.release).toHaveBeenCalledWith(mockBrowser);
		expect(mockConcurrencyManager.release).toHaveBeenCalledWith(
			'example.com',
		);
	});

	it('cleans up network interceptor and releases slot when task fails', async () => {
		const startInterceptionSpy = jest
			.spyOn(NetworkInterceptor.prototype, 'startInterception')
			.mockResolvedValue(undefined);
		const stopInterceptionSpy = jest
			.spyOn(NetworkInterceptor.prototype, 'stopInterception')
			.mockImplementation(() => undefined);
		const waitForCompressionsSpy = jest
			.spyOn(NetworkInterceptor.prototype, 'waitForCompressions')
			.mockResolvedValue(undefined);
		const clearCacheSpy = jest
			.spyOn(NetworkInterceptor.prototype, 'clearCache')
			.mockResolvedValue(undefined);

		await expect(
			runner.run(
				'https://example.com/chapter-1',
				baseConfig({ useNetworkInterception: true }),
				async () => {
					throw new Error('task failed');
				},
			),
		).rejects.toThrow('task failed');

		expect(startInterceptionSpy).toHaveBeenCalled();
		expect(stopInterceptionSpy).toHaveBeenCalled();
		expect(waitForCompressionsSpy).toHaveBeenCalled();
		expect(clearCacheSpy).toHaveBeenCalled();
		expect(mockConcurrencyManager.release).toHaveBeenCalledWith(
			'example.com',
		);
	});

	it('releases concurrency slot when browser launch fails', async () => {
		mockBrowserFactory.launch.mockRejectedValueOnce(
			new Error('launch failed'),
		);

		await expect(
			runner.run(
				'https://example.com/chapter-1',
				baseConfig(),
				async () => 'never',
			),
		).rejects.toThrow('launch failed');

		expect(mockConcurrencyManager.release).toHaveBeenCalledWith(
			'example.com',
		);
		expect(mockBrowserFactory.release).not.toHaveBeenCalled();
	});
});
