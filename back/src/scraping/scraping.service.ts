import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { AppConfigService } from 'src/app-config/app-config.service';
import { FilesService } from 'src/files/files.service';
import { WebsiteService } from './website.service';
import { WebsiteConfigDto } from './dto/website-config.dto';
import { PlaywrightBrowserFactory } from './browser';
import { IConcurrencyManager, InMemoryConcurrencyManager } from './concurrency';
import { ImageDownloader, PageScroller, NetworkInterceptor, ElementScreenshot } from './helpers';

@Injectable()
export class ScrapingService implements OnApplicationShutdown {
	private readonly logger = new Logger(ScrapingService.name);
	private browser: Browser | null = null;
	private browserFactory: PlaywrightBrowserFactory;
	private concurrencyManager: IConcurrencyManager =
		new InMemoryConcurrencyManager();

	constructor(
		private readonly appConfigService: AppConfigService,
		private readonly filesService: FilesService,
		private readonly webSiteService: WebsiteService,
	) {
		this.initializeBrowserFactory();
	}

	private initializeBrowserFactory(): void {
		const { debugMode, slowMo, wsEndpoint } = this.appConfigService.playwright;

		this.browserFactory = new PlaywrightBrowserFactory({
			headless: !debugMode,
			debugMode,
			slowMo,
			wsEndpoint,
			downloadDir: '/usr/src/app/data',
		});

		if (debugMode) {
			this.logger.log('🔍 Playwright DEBUG mode enabled');
		}
		this.logger.debug('Browser factory initialized');
	}

	setConcurrencyManager(manager: IConcurrencyManager): void {
		this.concurrencyManager = manager;
		this.logger.debug('Concurrency manager replaced');
	}

	setBrowserFactory(factory: PlaywrightBrowserFactory): void {
		this.browserFactory = factory;
		this.logger.debug('Browser factory replaced');
	}

	private async getBrowser(): Promise<Browser> {
		if (!this.browser || !this.browser.isConnected()) {
			this.browser = await this.browserFactory.launch();
		}
		return this.browser;
	}

	private async createPageWithContext(): Promise<{
		context: BrowserContext;
		page: Page;
	}> {
		const browser = await this.getBrowser();
		const context = await this.browserFactory.createContext(browser);
		const page = await this.browserFactory.createPage(context);
		return { context, page };
	}

	private async closeContext(context: BrowserContext): Promise<void> {
		try {
			await context.close();
		} catch (error) {
			this.logger.warn('Error closing context', error);
		}
	}

	private async getWebsiteConfig(url: string): Promise<WebsiteConfigDto> {
		let selector = 'img';
		let preScript = '';
		let posScript = '';
		let ignoreFiles: string[] = [];
		let concurrencyLimit: number | null = null;
		let blacklistTerms: string[] = [];
		let whitelistTerms: string[] = [];
		let useNetworkInterception = true;
		let useScreenshotMode = false;

		const domain = new URL(url).hostname;
		const website = await this.webSiteService.getByUrl(domain);

		if (website) {
			selector = website.selector || selector;
			preScript = website.preScript || preScript;
			posScript = website.posScript || posScript;
			ignoreFiles = website.ignoreFiles || [];
			concurrencyLimit = website.concurrencyLimit ?? null;
			blacklistTerms = website.blacklistTerms || [];
			whitelistTerms = website.whitelistTerms || [];
			useNetworkInterception = website.useNetworkInterception ?? true;
			useScreenshotMode = website.useScreenshotMode ?? false;
		}

		return {
			selector,
			preScript,
			posScript,
			ignoreFiles,
			concurrencyLimit,
			blacklistTerms,
			whitelistTerms,
			useNetworkInterception,
			useScreenshotMode,
		};
	}

	private async executeCustomScript(
		page: Page,
		script: string,
	): Promise<void> {
		if (!script) return;

		try {
			await page.evaluate(script);
			await page.waitForTimeout(3000);
		} catch (error) {
			this.logger.warn('Error executing custom script', error);
		}
	}

	private async downloadAndSaveImages(
		imageDownloader: ImageDownloader,
		imageUrls: string[],
		failedUrls: string[],
		ignoreFiles: string[],
		networkInterceptor?: NetworkInterceptor,
	): Promise<(string | null)[]> {
		const results: (string | null)[] = [];

		for (const imageUrl of imageUrls) {
			if (failedUrls.includes(imageUrl)) {
				this.logger.warn(`Image failed to load: ${imageUrl}`);
				results.push(null);
				continue;
			}

			if (ignoreFiles.includes(imageUrl)) {
				this.logger.warn(`Image ignored by config: ${imageUrl}`);
				results.push(null);
				continue;
			}

			let base64Data: string | null = null;
			let extension: string;

			// Try to get from network cache first (more efficient)
			if (networkInterceptor?.hasImage(imageUrl)) {
				base64Data = networkInterceptor.getCachedImageAsBase64(imageUrl);
				extension = networkInterceptor.getExtension(imageUrl);
				this.logger.debug(`Cache hit for: ${imageUrl}`);
			} else {
				// Fallback to fetch
				base64Data = await imageDownloader.fetchImageAsBase64(imageUrl);
				extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
				this.logger.debug(`Cache miss, fetched: ${imageUrl}`);
			}

			if (!base64Data) {
				results.push(null);
				continue;
			}

			const savedPath = await this.filesService.saveBase64File(
				base64Data,
				extension,
			);
			results.push(savedPath);
		}

		return results;
	}

	async scrapePages(url: string, pages = 0): Promise<string[] | null> {
		const config = await this.getWebsiteConfig(url);
		const {
			selector,
			preScript,
			posScript,
			ignoreFiles,
			concurrencyLimit,
			blacklistTerms,
			whitelistTerms,
			useNetworkInterception,
			useScreenshotMode,
		} = config;
		const domain = new URL(url).hostname;

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		const { context, page } = await this.createPageWithContext();
		let networkInterceptor: NetworkInterceptor | undefined;

		try {
			// Setup network interception BEFORE navigation (if enabled and not in screenshot mode)
			if (useNetworkInterception && !useScreenshotMode) {
				networkInterceptor = new NetworkInterceptor(page, {
					blacklistTerms,
					whitelistTerms,
				});
				await networkInterceptor.startInterception();
				this.logger.debug('Network interception enabled');
			}

			// Navigate to the page
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for title to be present
			await page.waitForFunction(() => document.title.length > 0, {
				timeout: 10000,
			});

			// Execute pre-scraping script
			await this.executeCustomScript(page, preScript);

			// Scroll and wait for lazy-loaded images
			const scroller = new PageScroller(page, { imageSelector: selector });
			const scrollResult = await scroller.scrollAndWait();

			// Execute post-scraping script
			await this.executeCustomScript(page, posScript);

			// Stop interception and log stats
			if (networkInterceptor) {
				networkInterceptor.stopInterception();
				const stats = networkInterceptor.getStats();
				this.logger.log(
					`Network cache: ${stats.count} images, ${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB`,
				);
			}

			let successfulPaths: (string | null)[];

			if (useScreenshotMode) {
				// Screenshot mode: capture elements as PNG (lossless)
				this.logger.log('📸 Using screenshot mode for image capture (PNG)');
				successfulPaths = await this.captureElementsAsScreenshots(
					page,
					selector,
					pages,
				);
			} else {
				// Standard mode: download images
				const imageDownloader = new ImageDownloader(page);
				const imageUrls = await imageDownloader.getImageUrls(selector);

				// Check if we have enough pages
				if (imageUrls.length <= pages) {
					return null;
				}

				this.logger.log(
					`Found ${imageUrls.length} valid image URLs. Starting downloads.`,
				);

				// Download and save images (using cache when available)
				successfulPaths = await this.downloadAndSaveImages(
					imageDownloader,
					imageUrls,
					scrollResult.failedImages,
					ignoreFiles,
					networkInterceptor,
				);
			}

			return successfulPaths.filter(Boolean) as string[];
		} catch (error) {
			this.logger.error('Error during scraping process.', error);
			throw error;
		} finally {
			networkInterceptor?.clearCache();
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	/**
	 * Captura elementos como screenshots (modo alternativo para canvas/proteção)
	/**
	 * Captura elementos como screenshots PNG (lossless) para máxima qualidade
	 */
	private async captureElementsAsScreenshots(
		page: Page,
		selector: string,
		minPages: number,
	): Promise<(string | null)[]> {
		const elementScreenshot = new ElementScreenshot(page, {
			selector,
			format: 'png', // Sempre PNG para máxima qualidade
		});

		const count = await elementScreenshot.getElementCount();

		if (count <= minPages) {
			return [];
		}

		this.logger.log(`Found ${count} elements. Capturing PNG screenshots...`);

		const screenshots = await elementScreenshot.captureAllAsBase64();
		const results: (string | null)[] = [];

		for (const base64 of screenshots) {
			try {
				const savedPath = await this.filesService.saveBase64File(base64, '.png');
				results.push(savedPath);
			} catch (error) {
				this.logger.warn('Failed to save screenshot', error);
				results.push(null);
			}
		}

		this.logger.log(`Captured ${results.filter(Boolean).length}/${count} screenshots`);
		return results;
	}

	async scrapeSingleImage(url: string, imageUrl: string): Promise<string> {
		const config = await this.getWebsiteConfig(url);
		const { concurrencyLimit, blacklistTerms, whitelistTerms, useNetworkInterception } = config;
		const domain = new URL(url).hostname;

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		const { context, page } = await this.createPageWithContext();
		let networkInterceptor: NetworkInterceptor | undefined;

		try {
			// Setup network interception BEFORE navigation (if enabled)
			if (useNetworkInterception) {
				networkInterceptor = new NetworkInterceptor(page, {
					blacklistTerms,
					whitelistTerms,
				});
				await networkInterceptor.startInterception();
			}

			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Try to get from cache first
			let base64Data: string | null = null;
			let extension: string;

			if (networkInterceptor?.hasImage(imageUrl)) {
				base64Data = networkInterceptor.getCachedImageAsBase64(imageUrl);
				extension = networkInterceptor.getExtension(imageUrl);
			} else {
				const imageDownloader = new ImageDownloader(page);
				base64Data = await imageDownloader.fetchImageAsBase64(imageUrl);
				extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
			}

			if (!base64Data) {
				throw new Error(`Failed to download image: ${imageUrl}`);
			}

			return this.filesService.saveBase64File(base64Data, extension);
		} catch (error) {
			this.logger.error('Error during scraping process.', error);
			throw error;
		} finally {
			networkInterceptor?.clearCache();
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	async scrapeMultipleImages(
		url: string,
		imageUrls: string[],
	): Promise<(string | null)[]> {
		const config = await this.getWebsiteConfig(url);
		const { concurrencyLimit, blacklistTerms, whitelistTerms, useNetworkInterception } = config;
		const domain = new URL(url).hostname;

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		const { context, page } = await this.createPageWithContext();
		let networkInterceptor: NetworkInterceptor | undefined;

		try {
			// Setup network interception BEFORE navigation (if enabled)
			if (useNetworkInterception) {
				networkInterceptor = new NetworkInterceptor(page, {
					blacklistTerms,
					whitelistTerms,
				});
				await networkInterceptor.startInterception();
			}

			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for title
			await page.waitForFunction(() => document.title.length > 0, {
				timeout: 10000,
			});

			const imageDownloader = new ImageDownloader(page);
			const results: (string | null)[] = [];

			for (const imageUrl of imageUrls) {
				try {
					let base64Data: string | null = null;
					let extension: string;

					// Try cache first
					if (networkInterceptor?.hasImage(imageUrl)) {
						base64Data = networkInterceptor.getCachedImageAsBase64(imageUrl);
						extension = networkInterceptor.getExtension(imageUrl);
					} else {
						base64Data = await imageDownloader.fetchImageAsBase64(imageUrl);
						extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
					}

					if (!base64Data) {
						this.logger.warn(`Failed to download image: ${imageUrl}`);
						results.push(null);
						continue;
					}

					const saved = await this.filesService.saveBase64File(
						base64Data,
						extension,
					);
					results.push(saved);
				} catch (err) {
					this.logger.warn(`Error processing image ${imageUrl}`, err);
					results.push(null);
				}
			}

			return results;
		} finally {
			networkInterceptor?.clearCache();
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	async onApplicationShutdown(): Promise<void> {
		this.logger.log('Shutting down scraping service...');
		if (this.browser) {
			try {
				await this.browser.close();
				this.browser = null;
			} catch (error) {
				this.logger.warn('Error closing browser', error);
			}
		}
	}
}
