import { Injectable, Logger } from '@nestjs/common';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium as playwrightChromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PooledBrowser } from '../pool';
import {
	BrowserConfig,
	DEFAULT_BROWSER_CONFIG,
} from './browser-config.interface';
import { IBrowserFactory } from './browser.factory.interface';

/**
 * Extended Browser type with pool metadata
 */
interface PooledBrowserInstance extends Browser {
	__pooled?: boolean;
	__pooledId?: string;
	__pooledRef?: PooledBrowser;
}

/**
 * Factory for creating Playwright browser instances with stealth mode.
 * Uses playwright-extra with stealth plugin to avoid bot detection.
 * Supports browser pooling for resource efficiency.
 */
@Injectable()
export class PlaywrightBrowserFactory implements IBrowserFactory {
	private readonly logger = new Logger(PlaywrightBrowserFactory.name);
	private readonly config: Required<BrowserConfig>;
	private stealthInitialized = false;
	private browserPool?: import('../pool').BrowserPoolService;

	constructor(config?: Partial<BrowserConfig>) {
		this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
		this.initializeStealth();
	}

	/**
	 * Set the browser pool for resource management.
	 * Should be called by the scraping module during initialization.
	 */
	setBrowserPool(pool: import('../pool').BrowserPoolService): void {
		this.browserPool = pool;
		this.logger.log('Browser pool integration enabled');
	}

	private initializeStealth(): void {
		if (this.config.stealth && !this.stealthInitialized) {
			playwrightChromium.use(StealthPlugin());
			this.stealthInitialized = true;
			this.logger.debug('Stealth plugin initialized');
		}
	}

	async launch(): Promise<Browser> {
		// Try to use browser pool if available
		if (this.browserPool) {
			try {
				const pooledBrowser = await this.browserPool.acquire();
				this.logger.debug(
					`Acquired browser from pool: ${pooledBrowser.id}`,
				);
				// Tag the browser so we know it came from the pool
				const browser = pooledBrowser.browser as PooledBrowserInstance;
				browser.__pooled = true;
				browser.__pooledId = pooledBrowser.id;
				browser.__pooledRef = pooledBrowser;
				return browser;
			} catch (error) {
				this.logger.warn(
					`Failed to acquire from pool, falling back to direct launch: ${error.message}`,
				);
			}
		}

		// Fallback to direct launch
		return this.launchDirect();
	}

	/**
	 * Launch a browser directly (not from pool).
	 */
	private async launchDirect(): Promise<Browser> {
		const isDebug = this.config.debugMode;
		const wsEndpoint = this.config.wsEndpoint;

		this.logger.log(
			`🚀 Preparando navegador (Debug: ${isDebug}, Remote: ${!!wsEndpoint})`,
		);

		// Se estamos em modo debug ou temos um endpoint, tentamos conexão remota primeiro
		if (wsEndpoint) {
			try {
				this.logger.log(
					`Connecting to remote browser at ${wsEndpoint}...`,
				);
				const { chromium } = await import('playwright');
				return await chromium.connectOverCDP(wsEndpoint, {
					timeout: 15000,
				});
			} catch (error) {
				this.logger.error(
					`❌ Failed to connect to remote browser: ${error.message}`,
				);
				if (isDebug) {
					this.logger.warn(
						'⚠️  DEBUG MODE REQUIRES REMOTE BROWSER IN DOCKER!',
					);
				}
			}
		}

		// Fallback para local (apenas se não houver endpoint ou se falhar)
		this.logger.warn('Falling back to local browser instance...');
		const headless = isDebug ? false : this.config.headless;
		const slowMo = isDebug ? this.config.slowMo || 100 : this.config.slowMo;

		return await playwrightChromium.launch({
			headless,
			slowMo,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--disable-gpu',
				'--disable-web-security',
				'--disable-features=IsolateOrigins,site-per-process',
				'--disable-blink-features=AutomationControlled',
				'--disable-infobars',
				'--window-size=1920,1080',
			],
		});
	}

	async createContext(browser: Browser): Promise<BrowserContext> {
		this.logger.debug('Creating browser context...');

		// Increment context count if this is a pooled browser
		const pooledBrowser = browser as PooledBrowserInstance;
		if (pooledBrowser.__pooledRef) {
			this.browserPool?.incrementContextCount(pooledBrowser.__pooledRef);
		}

		const context = await browser.newContext({
			userAgent: this.config.userAgent,
			viewport: this.config.viewport,
			locale: this.config.locale,
			timezoneId: this.config.timezoneId,
			acceptDownloads: true,
			ignoreHTTPSErrors: true,
			javaScriptEnabled: true,
			bypassCSP: true,
			permissions: ['geolocation'],
		});

		// Set default timeouts
		context.setDefaultNavigationTimeout(this.config.navigationTimeout);
		context.setDefaultTimeout(this.config.actionTimeout);

		this.logger.debug('Browser context created');
		return context;
	}

	async createPage(context: BrowserContext): Promise<Page> {
		this.logger.debug('Creating new page...');

		const page = await context.newPage();

		// Add extra stealth measures
		await this.applyStealthMeasures(page);

		this.logger.debug('Page created');
		return page;
	}

	/**
	 * Apply additional stealth measures to the page.
	 */
	private async applyStealthMeasures(page: Page): Promise<void> {
		try {
			await page.addInitScript(() => {
				// Override navigator.webdriver
				Object.defineProperty(navigator, 'webdriver', {
					get: () => undefined,
				});

				// Add fake plugins
				Object.defineProperty(navigator, 'plugins', {
					get: () => [
						{ name: 'Chrome PDF Plugin' },
						{ name: 'Chrome PDF Viewer' },
						{ name: 'Native Client' },
					],
				});

				// Override permissions
				const originalQuery = window.navigator.permissions.query;
				window.navigator.permissions.query = (
					parameters: PermissionDescriptor,
				) =>
					parameters.name === 'notifications'
						? Promise.resolve({
								state: Notification.permission,
							} as PermissionStatus)
						: originalQuery(parameters);

				// Add chrome runtime
				const win = window as unknown as Window & {
					chrome?: { runtime: Record<string, unknown> };
				};
				if (!win.chrome) {
					win.chrome = {
						runtime: {},
					};
				}
			});
		} catch (error) {
			this.logger.warn('Failed to apply stealth measures', error);
		}
	}

	/**
	 * Create a complete browser setup (browser + context + page).
	 * Convenience method for simple use cases.
	 */
	async createBrowserWithPage(): Promise<{
		browser: Browser;
		context: BrowserContext;
		page: Page;
	}> {
		const browser = await this.launch();
		const context = await this.createContext(browser);
		const page = await this.createPage(context);
		return { browser, context, page };
	}

	/**
	 * Release a browser back to the pool or close it if not pooled.
	 * MUST be called after using a browser to prevent resource leaks.
	 */
	async release(browser: Browser): Promise<void> {
		// Check if this is a pooled browser
		const pooledBrowser = browser as PooledBrowserInstance;
		if (pooledBrowser.__pooled && pooledBrowser.__pooledRef) {
			this.logger.debug(
				`Releasing browser ${pooledBrowser.__pooledRef.id} to pool`,
			);
			await this.browserPool?.release(pooledBrowser.__pooledRef);
		} else {
			// Not from pool, close directly
			this.logger.debug('Closing non-pooled browser');
			try {
				await browser.close();
			} catch (error) {
				this.logger.warn(`Error closing browser: ${error.message}`);
			}
		}
	}

	/**
	 * Shutdown the factory and release all resources.
	 * Called during application shutdown.
	 */
	async shutdown(): Promise<void> {
		this.logger.log('Shutting down browser factory...');
		// The pool will handle its own shutdown via onModuleDestroy
		this.logger.log('Browser factory shutdown complete');
	}

	getConfig(): Required<BrowserConfig> {
		return { ...this.config };
	}
}
