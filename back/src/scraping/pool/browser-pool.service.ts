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
	private healthCheckInterval?: ReturnType<typeof setInterval>;

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

		this.healthCheckInterval = setInterval(
			() => this.checkStuckBrowsers(),
			60_000,
		);
	}

	async onModuleDestroy() {
		await this.shutdown();
	}

	async acquire(): Promise<PooledBrowser> {
		if (this.isShuttingDown) {
			throw new Error('Browser pool is shutting down');
		}

		if (!this.poolConfig.enabled) {
			throw new Error(
				'Browser pool is disabled. Use factory.launch() directly.',
			);
		}

		const available = this.findAvailableBrowser();
		if (available) {
			return this.markBrowserInUse(available);
		}

		if (this.pool.size < this.poolConfig.poolSize) {
			const browser = await this.createBrowser();
			return this.markBrowserInUse(browser);
		}

		return this.waitForBrowser();
	}

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

		if (
			!browser.isPendingRestart &&
			browser.totalContextsCreated >=
				this.poolConfig.maxContextsBeforeRestart
		) {
			browser.isPendingRestart = true;
			browser.pendingRestartSince = new Date();
			this.logger.log(
				`Browser ${browser.id} reached context limit, draining before restart...`,
			);
		}

		if (
			browser.isPendingRestart &&
			browser.activeContexts === 0 &&
			!browser.isRestarting
		) {
			void this.restartBrowser(browser.id);
			return;
		}

		this.processWaitQueue();
	}

	incrementContextCount(pooledBrowser: PooledBrowser): void {
		const browser = this.pool.get(pooledBrowser.id);
		if (browser) {
			browser.totalContextsCreated++;
			this.logger.debug(
				`Browser ${browser.id} contexts: ${browser.totalContextsCreated}`,
			);
		}
	}

	getStats() {
		const browsers = Array.from(this.pool.values());
		return {
			totalBrowsers: browsers.length,
			activeBrowsers: browsers.filter((b) => b.activeContexts > 0).length,
			idleBrowsers: browsers.filter(
				(b) => b.activeContexts === 0 && !b.isPendingRestart,
			).length,
			unhealthyBrowsers: browsers.filter((b) => !b.isHealthy).length,
			pendingRestartBrowsers: browsers.filter((b) => b.isPendingRestart)
				.length,
			restartingBrowsers: browsers.filter((b) => b.isRestarting).length,
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

	private checkStuckBrowsers(): void {
		const now = Date.now();
		const stuckThresholdMs = this.poolConfig.acquireTimeout * 2;

		for (const browser of this.pool.values()) {
			if (
				browser.isPendingRestart &&
				!browser.isRestarting &&
				browser.pendingRestartSince &&
				now - browser.pendingRestartSince.getTime() > stuckThresholdMs
			) {
				const stuckSeconds = Math.round(
					(now - browser.pendingRestartSince.getTime()) / 1000,
				);
				this.logger.warn(
					`Browser ${browser.id} stuck in pendingRestart for ${stuckSeconds}s (leaked session?), forcing restart`,
				);
				void this.restartBrowser(browser.id);
			}
		}
	}

	async shutdown(): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.isShuttingDown = true;
		this.logger.log('🛑 Shutting down browser pool...');

		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval);
		}

		for (const waiter of this.waitQueue) {
			waiter.reject(new Error('Browser pool shutting down'));
		}
		this.waitQueue.length = 0;

		const closePromises: Promise<void>[] = [];
		for (const [id, pooledBrowser] of this.pool.entries()) {
			closePromises.push(
				this.closeBrowser(
					id,
					pooledBrowser.browser,
					pooledBrowser.disconnectedHandler,
				).catch((error) => {
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

	private async createBrowser(): Promise<PooledBrowser> {
		const id = `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		this.logger.debug(`Creating browser ${id}...`);

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

		const onDisconnected = (): void => {
			this.logger.warn(`Browser ${id} disconnected unexpectedly`);
			this.handleBrowserCrash(id);
		};
		browser.on('disconnected', onDisconnected);

		const pooledBrowser: PooledBrowser = {
			id,
			browser,
			activeContexts: 0,
			totalContextsCreated: 0,
			createdAt: new Date(),
			lastUsedAt: new Date(),
			isHealthy: true,
			isPendingRestart: false,
			isRestarting: false,
			disconnectedHandler: onDisconnected,
		};

		this.pool.set(id, pooledBrowser);
		this.logger.debug(`✅ Browser ${id} created`);

		return pooledBrowser;
	}

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

	private findAvailableBrowser(): PooledBrowser | null {
		for (const browser of this.pool.values()) {
			if (
				browser.isHealthy &&
				!browser.isPendingRestart &&
				browser.activeContexts < this.poolConfig.maxContextsPerBrowser
			) {
				return browser;
			}
		}
		return null;
	}

	private markBrowserInUse(pooledBrowser: PooledBrowser): PooledBrowser {
		pooledBrowser.activeContexts++;
		pooledBrowser.lastUsedAt = new Date();
		this.logger.debug(
			`Acquired browser ${pooledBrowser.id} (active contexts: ${pooledBrowser.activeContexts})`,
		);
		return pooledBrowser;
	}

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
			if (this.waitQueue.length > 0) {
				setImmediate(() => this.processWaitQueue());
			}
		}
	}

	private async handleBrowserCrash(id: string): Promise<void> {
		const browser = this.pool.get(id);
		if (!browser) {
			return;
		}

		browser.isHealthy = false;
		this.logger.error(`Browser ${id} crashed, restarting...`);

		await this.restartBrowser(id);
	}

	private async restartBrowser(id: string): Promise<void> {
		const oldBrowser = this.pool.get(id);
		if (!oldBrowser) {
			return;
		}

		if (oldBrowser.isRestarting) {
			this.logger.debug(
				`Browser ${id} already restarting, skipping duplicate call`,
			);
			return;
		}
		oldBrowser.isRestarting = true;

		this.pool.delete(id);
		await this.closeBrowser(
			id,
			oldBrowser.browser,
			oldBrowser.disconnectedHandler,
		);

		if (this.pool.size >= this.poolConfig.poolSize) {
			this.logger.warn(
				`Pool already at capacity (${this.pool.size}/${this.poolConfig.poolSize}), skipping replacement for ${id}`,
			);
			this.processWaitQueue();
			return;
		}

		try {
			const newBrowser = await this.createBrowser();
			this.logger.log(`✅ Browser ${id} replaced with ${newBrowser.id}`);
			this.processWaitQueue();
		} catch (error) {
			this.logger.error(
				`Failed to restart browser ${id}: ${error.message}`,
			);
		}
	}

	private async closeBrowser(
		id: string,
		browser: Browser,
		disconnectedHandler?: () => void,
	): Promise<void> {
		try {
			this.logger.debug(`Closing browser ${id}...`);
			if (disconnectedHandler) {
				browser.off('disconnected', disconnectedHandler);
			}
			await browser.close();
			this.logger.debug(`Browser ${id} closed`);
		} catch (error) {
			this.logger.error(`Error closing browser ${id}: ${error.message}`);
		}
	}
}
