import {
	Injectable,
	Logger,
	OnModuleDestroy,
	OnModuleInit,
} from '@nestjs/common';
import { Browser } from 'playwright';
import { chromium as playwrightChromium } from 'playwright-extra';
import { BrowserConfig } from '../browser/browser-config.interface';
import {
	BrowserPoolConfig,
	DEFAULT_BROWSER_POOL_CONFIG,
	PooledBrowser,
} from './browser-pool-config.interface';

/**
 * Browser pool service that manages a pool of Playwright browser instances.
 * Reduces overhead of launching browsers for each scraping session.
 */
@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(BrowserPoolService.name);
	private readonly pool: Map<string, PooledBrowser> = new Map();
	private readonly waitQueue: Array<{
		resolve: (browser: PooledBrowser) => void;
		reject: (error: Error) => void;
		timestamp: number;
	}> = [];
	private isShuttingDown = false;
	private poolConfig: BrowserPoolConfig;
	private browserConfig?: Required<BrowserConfig>;

	constructor(
		poolConfig?: Partial<BrowserPoolConfig>,
		browserConfig?: Required<BrowserConfig>,
	) {
		this.poolConfig = { ...DEFAULT_BROWSER_POOL_CONFIG, ...poolConfig };
		if (browserConfig) {
			this.browserConfig = browserConfig;
		}
	}

	async onModuleInit() {
		if (!this.poolConfig.enabled) {
			this.logger.log('Browser pool is disabled');
			return;
		}

		this.logger.log(
			`🏊 Initializing browser pool (size: ${this.poolConfig.poolSize})`,
		);

		// Pre-warm the pool
		const warmupPromises: Promise<PooledBrowser | undefined>[] = [];
		for (let i = 0; i < this.poolConfig.poolSize; i++) {
			warmupPromises.push(
				this.createBrowser().catch((error) => {
					this.logger.error(
						`Failed to create browser ${i} during warmup: ${error.message}`,
					);
					return undefined;
				}),
			);
		}

		await Promise.allSettled(warmupPromises);
		this.logger.log(
			`✅ Browser pool initialized with ${this.pool.size} browsers`,
		);
	}

	async onModuleDestroy() {
		await this.shutdown();
	}

	/**
	 * Acquire a browser from the pool.
	 * If all browsers are at capacity, waits for one to become available.
	 */
	async acquire(): Promise<PooledBrowser> {
		if (this.isShuttingDown) {
			throw new Error('Browser pool is shutting down');
		}

		if (!this.poolConfig.enabled) {
			throw new Error(
				'Browser pool is disabled. Use factory.launch() directly.',
			);
		}

		// Try to find an available browser
		const available = this.findAvailableBrowser();
		if (available) {
			return this.markBrowserInUse(available);
		}

		// If pool not full, create a new browser
		if (this.pool.size < this.poolConfig.poolSize) {
			const browser = await this.createBrowser();
			return this.markBrowserInUse(browser);
		}

		// Wait for a browser to become available
		return this.waitForBrowser();
	}

	/**
	 * Release a browser back to the pool.
	 */
	async release(pooledBrowser: PooledBrowser): Promise<void> {
		const browser = this.pool.get(pooledBrowser.id);
		if (!browser) {
			this.logger.warn(
				`Attempted to release unknown browser: ${pooledBrowser.id}`,
			);
			return;
		}

		browser.activeContexts = Math.max(0, browser.activeContexts - 1);
		browser.lastUsedAt = new Date();

		this.logger.debug(
			`Released browser ${browser.id} (active contexts: ${browser.activeContexts})`,
		);

		// Check if browser needs restart
		if (
			browser.totalContextsCreated >=
			this.poolConfig.maxContextsBeforeRestart
		) {
			this.logger.log(
				`Browser ${browser.id} reached context limit, restarting...`,
			);
			await this.restartBrowser(browser.id);
			return;
		}

		// Process wait queue
		this.processWaitQueue();
	}

	/**
	 * Increment context count when a context is created.
	 */
	incrementContextCount(pooledBrowser: PooledBrowser): void {
		const browser = this.pool.get(pooledBrowser.id);
		if (browser) {
			browser.totalContextsCreated++;
			this.logger.debug(
				`Browser ${browser.id} contexts: ${browser.totalContextsCreated}`,
			);
		}
	}

	/**
	 * Get pool statistics.
	 */
	getStats() {
		const browsers = Array.from(this.pool.values());
		return {
			totalBrowsers: browsers.length,
			activeBrowsers: browsers.filter((b) => b.activeContexts > 0).length,
			idleBrowsers: browsers.filter((b) => b.activeContexts === 0).length,
			unhealthyBrowsers: browsers.filter((b) => !b.isHealthy).length,
			totalActiveContexts: browsers.reduce(
				(sum, b) => sum + b.activeContexts,
				0,
			),
			totalContextsCreated: browsers.reduce(
				(sum, b) => sum + b.totalContextsCreated,
				0,
			),
			waitQueueLength: this.waitQueue.length,
			poolConfig: this.poolConfig,
		};
	}

	/**
	 * Gracefully shutdown the pool.
	 */
	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.isShuttingDown = true;
		this.logger.log('🛑 Shutting down browser pool...');

		// Reject all waiting requests
		for (const waiter of this.waitQueue) {
			waiter.reject(new Error('Browser pool shutting down'));
		}
		this.waitQueue.length = 0;

		// Close all browsers
		const closePromises: Promise<void>[] = [];
		for (const [id, pooledBrowser] of this.pool.entries()) {
			closePromises.push(
				this.closeBrowser(id, pooledBrowser.browser).catch((error) => {
					this.logger.error(
						`Failed to close browser ${id}: ${error.message}`,
					);
				}),
			);
		}

		await Promise.allSettled(closePromises);
		this.pool.clear();
		this.logger.log('✅ Browser pool shutdown complete');
	}

	/**
	 * Create a new browser instance.
	 */
	private async createBrowser(): Promise<PooledBrowser> {
		const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		this.logger.debug(`Creating browser ${id}...`);

		// Use wsEndpoint if configured (remote browser)
		let browser: Browser;
		const wsEndpoint = this.browserConfig?.wsEndpoint;

		if (wsEndpoint) {
			try {
				const { chromium } = await import('playwright');
				browser = await chromium.connectOverCDP(wsEndpoint, {
					timeout: 15000,
				});
				this.logger.debug(`Browser ${id} connected to remote endpoint`);
			} catch (error) {
				this.logger.warn(
					`Failed to connect to remote browser, launching locally: ${error.message}`,
				);
				browser = await this.launchLocalBrowser();
			}
		} else {
			browser = await this.launchLocalBrowser();
		}

		// Monitor browser crashes
		browser.on('disconnected', () => {
			this.logger.warn(`Browser ${id} disconnected unexpectedly`);
			this.handleBrowserCrash(id);
		});

		const pooledBrowser: PooledBrowser = {
			id,
			browser,
			activeContexts: 0,
			totalContextsCreated: 0,
			createdAt: new Date(),
			lastUsedAt: new Date(),
			isHealthy: true,
		};

		this.pool.set(id, pooledBrowser);
		this.logger.debug(`✅ Browser ${id} created`);

		return pooledBrowser;
	}

	/**
	 * Launch a local browser instance.
	 */
	private async launchLocalBrowser(): Promise<Browser> {
		const headless = this.browserConfig?.headless ?? true;
		const slowMo = this.browserConfig?.slowMo ?? 0;

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

	/**
	 * Find an available browser in the pool.
	 */
	private findAvailableBrowser(): PooledBrowser | null {
		for (const browser of this.pool.values()) {
			if (
				browser.isHealthy &&
				browser.activeContexts < this.poolConfig.maxContextsPerBrowser
			) {
				return browser;
			}
		}
		return null;
	}

	/**
	 * Mark a browser as in-use.
	 */
	private markBrowserInUse(pooledBrowser: PooledBrowser): PooledBrowser {
		pooledBrowser.activeContexts++;
		pooledBrowser.lastUsedAt = new Date();
		this.logger.debug(
			`Acquired browser ${pooledBrowser.id} (active contexts: ${pooledBrowser.activeContexts})`,
		);
		return pooledBrowser;
	}

	/**
	 * Wait for a browser to become available.
	 */
	private async waitForBrowser(): Promise<PooledBrowser> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				const index = this.waitQueue.findIndex(
					(w) => w.resolve === resolve,
				);
				if (index !== -1) {
					this.waitQueue.splice(index, 1);
				}
				reject(
					new Error(
						`Timeout waiting for browser (${this.poolConfig.acquireTimeout}ms)`,
					),
				);
			}, this.poolConfig.acquireTimeout);

			this.waitQueue.push({
				resolve: (browser) => {
					clearTimeout(timeout);
					resolve(browser);
				},
				reject: (error) => {
					clearTimeout(timeout);
					reject(error);
				},
				timestamp: Date.now(),
			});

			this.logger.debug(
				`Added to wait queue (position: ${this.waitQueue.length})`,
			);
		});
	}

	/**
	 * Process the wait queue when a browser becomes available.
	 */
	private processWaitQueue(): void {
		if (this.waitQueue.length === 0) {
			return;
		}

		const available = this.findAvailableBrowser();
		if (!available) {
			return;
		}

		const waiter = this.waitQueue.shift();
		if (waiter) {
			this.logger.debug('Processing wait queue request');
			waiter.resolve(this.markBrowserInUse(available));
			// Process more if available
			if (this.waitQueue.length > 0) {
				setImmediate(() => this.processWaitQueue());
			}
		}
	}

	/**
	 * Handle browser crash.
	 */
	private async handleBrowserCrash(id: string): Promise<void> {
		const browser = this.pool.get(id);
		if (!browser) {
			return;
		}

		browser.isHealthy = false;
		this.logger.error(`Browser ${id} crashed, restarting...`);

		await this.restartBrowser(id);
	}

	/**
	 * Restart a browser.
	 */
	private async restartBrowser(id: string): Promise<void> {
		const oldBrowser = this.pool.get(id);
		if (!oldBrowser) {
			return;
		}

		// Close old browser
		await this.closeBrowser(id, oldBrowser.browser);
		this.pool.delete(id);

		// Create new browser
		try {
			await this.createBrowser();
			this.logger.log(`Browser ${id} restarted successfully`);
		} catch (error) {
			this.logger.error(
				`Failed to restart browser ${id}: ${error.message}`,
			);
		}
	}

	/**
	 * Close a browser instance.
	 */
	private async closeBrowser(id: string, browser: Browser): Promise<void> {
		try {
			this.logger.debug(`Closing browser ${id}...`);
			await browser.close();
			this.logger.debug(`Browser ${id} closed`);
		} catch (error) {
			this.logger.error(`Error closing browser ${id}: ${error.message}`);
		}
	}
}
