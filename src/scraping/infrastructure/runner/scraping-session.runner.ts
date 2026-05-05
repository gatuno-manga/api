import { Logger } from '@nestjs/common';
import { Browser, BrowserContext, Page } from 'playwright';
import {
	ContextOptions,
	PlaywrightBrowserFactory,
} from '@scraping/infrastructure/browser';
import { IConcurrencyManager } from '@scraping/infrastructure/concurrency';
import { WebsiteConfigDto } from '@scraping/application/dto/website-config.dto';
import {
	FlareSolverrClient,
	ImageCompressor,
	NetworkInterceptor,
	StorageConfig,
	StorageInjector,
} from '@scraping/infrastructure/helpers';
import { ScrapingContext, ScrapingTask } from './scraping-context.interface';

export class ScrapingSessionRunner {
	private readonly logger = new Logger(ScrapingSessionRunner.name);
	private readonly flareSolverrClient: FlareSolverrClient | null = null;

	constructor(
		private readonly browserFactory: PlaywrightBrowserFactory,
		private readonly concurrencyManager: IConcurrencyManager,
		private readonly imageCompressor?: ImageCompressor,
		flareSolverrUrl?: string,
	) {
		if (flareSolverrUrl) {
			this.flareSolverrClient = new FlareSolverrClient(flareSolverrUrl);
		}
	}

	async run<T>(
		url: string,
		config: WebsiteConfigDto,
		task: ScrapingTask<T>,
	): Promise<T> {
		const domain = new URL(url).hostname;
		const { concurrencyLimit, proxyUrl, useFlareSolverr } = config;

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		let browser: Browser | null = null;
		let context: BrowserContext | null = null;
		let page: Page | null = null;
		let networkInterceptor: NetworkInterceptor | undefined;

		try {
			browser = await this.browserFactory.launch();

			// Proxy support
			const contextOptions: ContextOptions = {};
			if (proxyUrl) {
				contextOptions.proxy = { server: proxyUrl };
				this.logger.debug(`Using proxy for session: ${proxyUrl}`);
			}

			// FlareSolverr bypass (Call before creating context to get the UA)
			let flareSolverrCookies: Array<{
				name: string;
				value: string;
				domain: string;
				path: string;
				expires: number;
				httpOnly: boolean;
				secure: boolean;
				sameSite: 'Strict' | 'Lax' | 'None';
			}> = [];
			if (useFlareSolverr && this.flareSolverrClient) {
				this.logger.log(`Bypassing Cloudflare for ${url}...`);
				const solution = await this.flareSolverrClient.resolve(
					url,
					proxyUrl || undefined,
				);

				if (solution) {
					contextOptions.userAgent = solution.userAgent;
					flareSolverrCookies = solution.cookies.map((c) => ({
						name: c.name,
						value: c.value,
						domain: c.domain,
						path: c.path,
						expires: c.expires,
						httpOnly: c.httpOnly,
						secure: c.secure,
						sameSite: c.sameSite || 'Lax',
					}));
					this.logger.debug(
						`Obtained UA and ${flareSolverrCookies.length} cookies from FlareSolverr`,
					);
				}
			}

			context = await this.browserFactory.createContext(
				browser,
				contextOptions,
			);

			if (flareSolverrCookies.length > 0) {
				await context.addCookies(flareSolverrCookies);
			}

			page = await this.browserFactory.createPage(context);

			const storageInjector = this.createStorageInjector(config);

			// Setup Helpers
			if (storageInjector) {
				await storageInjector.injectCookies(context, domain);
				await storageInjector.addInitScriptForStorage(page);
			}

			if (config.useNetworkInterception && !config.useScreenshotMode) {
				networkInterceptor = new NetworkInterceptor(
					page,
					{
						blacklistTerms: config.blacklistTerms,
						whitelistTerms: config.whitelistTerms,
					},
					this.imageCompressor,
				);
				await networkInterceptor.startInterception();
			}

			// Navigation
			await page.goto(url, {
				waitUntil: 'domcontentloaded',
				timeout: 60000,
			});

			// Post-load storage injection
			if (storageInjector) {
				const hasLocalStorage =
					config.localStorage &&
					Object.keys(config.localStorage).length > 0;

				if (hasLocalStorage) {
					await storageInjector.injectLocalStorage(page);
					await storageInjector.injectSessionStorage(page);
					await page.reload({ waitUntil: 'domcontentloaded' });
					await page
						.waitForLoadState('networkidle', { timeout: 10000 })
						.catch(() => undefined);
				} else {
					const reloaded =
						await storageInjector.injectStorageAndReload(page);
					if (reloaded) {
						await page
							.waitForLoadState('networkidle', { timeout: 15000 })
							.catch(() => undefined);
					}
				}
			}

			// Wait for hydration/rendering
			await page
				.waitForFunction(() => document.title.length > 0, {
					timeout: 10000,
				})
				.catch(() => undefined);

			// Execute scraping task
			const scrapingContext: ScrapingContext = {
				page,
				context,
				config,
				networkInterceptor,
				storageInjector,
			};

			return await task(scrapingContext);
		} finally {
			// Cleanup order:
			// 1. Stop interception immediately (no new responses accepted)
			// 2. Drain in-flight compressions while page is still alive
			// 3. Close page
			// 4. Clear cache (safe: _cleared flag set, compressions already drained)
			// 5. Close context
			// 6. Release browser
			// 7. Release concurrency slot
			if (networkInterceptor) {
				try {
					networkInterceptor.stopInterception();
					await networkInterceptor.waitForCompressions();
				} catch (e) {
					this.logger.warn('Error stopping network interceptor', e);
				}
			}

			if (page) {
				try {
					await page.close();
					this.logger.debug('Page closed');
				} catch (e) {
					this.logger.warn('Error closing page', e);
				}
			}

			if (networkInterceptor) {
				try {
					await networkInterceptor.clearCache();
				} catch (e) {
					this.logger.warn(
						'Error clearing network interceptor cache',
						e,
					);
				}
			}

			if (context) {
				try {
					await context.close();
					this.logger.debug('Context closed');
				} catch (e) {
					this.logger.warn('Error closing context', e);
				}
			}

			if (browser) {
				try {
					await this.browserFactory.release(browser);
					this.logger.debug('Browser released');
				} catch (e) {
					this.logger.warn('Error releasing browser', e);
				}
			}

			this.concurrencyManager.release(domain);
		}
	}

	private createStorageInjector(
		config: WebsiteConfigDto,
	): StorageInjector | null {
		const storageConfig: StorageConfig = {
			cookies: config.cookies,
			localStorage: config.localStorage,
			sessionStorage: config.sessionStorage,
			reloadAfterStorageInjection: config.reloadAfterStorageInjection,
		};

		const injector = new StorageInjector(storageConfig);
		return injector.hasStorageConfig() ? injector : null;
	}
}
