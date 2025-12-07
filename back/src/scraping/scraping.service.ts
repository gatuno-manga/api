import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { AppConfigService } from 'src/app-config/app-config.service';
import { FilesService } from 'src/files/files.service';
import { WebsiteService } from './website.service';
import { WebsiteConfigDto } from './dto/website-config.dto';
import { PlaywrightBrowserFactory } from './browser';
import { IConcurrencyManager, InMemoryConcurrencyManager } from './concurrency';
import { ImageDownloader, PageScroller, NetworkInterceptor, ElementScreenshot, ImageCompressor } from './helpers';

@Injectable()
export class ScrapingService implements OnApplicationShutdown {
	private readonly logger = new Logger(ScrapingService.name);
	private browser: Browser | null = null;
	private browserFactory: PlaywrightBrowserFactory;
	private concurrencyManager: IConcurrencyManager =
		new InMemoryConcurrencyManager();
	private imageCompressor: ImageCompressor | undefined;

	constructor(
		private readonly appConfigService: AppConfigService,
		private readonly filesService: FilesService,
		private readonly webSiteService: WebsiteService,
	) {
		this.initializeBrowserFactory();
		this.initializeImageCompressor();
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

	private initializeImageCompressor(): void {
		const compressorFactory = this.filesService.getCompressorFactory();

		// Create an adapter that implements ImageCompressor interface
		this.imageCompressor = {
			compress: (buffer: Buffer) => compressorFactory.compress(buffer, '.jpg').then(r => r.buffer),
			getOutputExtension: (ext: string) => {
				// Get actual output extension from compressor
				const compressor = compressorFactory.getCompressor(ext);
				return compressor?.getOutputExtension(ext) ?? ext;
			},
		};

		this.logger.debug('Image compressor initialized for network interception');
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
		let concurrencyLimit: number | null = null;
		let blacklistTerms: string[] = [];
		let whitelistTerms: string[] = [];
		let useNetworkInterception = true;
		let useScreenshotMode = false;
		let chapterListSelector: string | undefined;
		let bookInfoExtractScript: string | undefined;

		const domain = new URL(url).hostname;
		const website = await this.webSiteService.getByUrl(domain);

		if (website) {
			selector = website.selector || selector;
			preScript = website.preScript || preScript;
			posScript = website.posScript || posScript;
			concurrencyLimit = website.concurrencyLimit ?? null;
			blacklistTerms = website.blacklistTerms || [];
			whitelistTerms = website.whitelistTerms || [];
			useNetworkInterception = website.useNetworkInterception ?? true;
			useScreenshotMode = website.useScreenshotMode ?? false;
			chapterListSelector = website.chapterListSelector || undefined;
			bookInfoExtractScript = website.bookInfoExtractScript || undefined;
		}

		return {
			selector,
			preScript,
			posScript,
			concurrencyLimit,
			blacklistTerms,
			whitelistTerms,
			useNetworkInterception,
			useScreenshotMode,
			chapterListSelector,
			bookInfoExtractScript,
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
		networkInterceptor?: NetworkInterceptor,
	): Promise<(string | null)[]> {
		const results: (string | null)[] = [];

		for (const imageUrl of imageUrls) {
			if (failedUrls.includes(imageUrl)) {
				this.logger.warn(`Image failed to load: ${imageUrl}`);
				results.push(null);
				continue;
			}

			let bufferData: Buffer | null = null;
			let extension: string = '.jpg';
			let isPreCompressed = false;

			// Try to get from network cache first (more efficient)
			if (networkInterceptor) {
				if (networkInterceptor.hasImage(imageUrl)) {
					bufferData = networkInterceptor.getCachedImageAsBuffer(imageUrl);
					extension = networkInterceptor.getExtension(imageUrl);
					isPreCompressed = networkInterceptor.isCompressed(imageUrl);
					this.logger.debug(`Cache hit for: ${imageUrl} (compressed: ${isPreCompressed})`);
				} else {
					this.logger.warn(`Image not found in network cache: ${imageUrl}`);
				}
			} else {
				// Fallback to fetch using Playwright's request context
				bufferData = await imageDownloader.fetchImageAsBuffer(imageUrl);
				if (!bufferData) {
					// Fallback to page context fetch if 403
					this.logger.debug(`Retrying with page context fetch: ${imageUrl}`);
					bufferData = await imageDownloader.fetchImageViaPageContext(imageUrl);
				}
				extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
				this.logger.debug(`Cache miss, fetched: ${imageUrl}`);
			}

			if (!bufferData) {
				results.push(null);
				continue;
			}

			// Save file - skip compression if already compressed during interception
			const savedPath = isPreCompressed
				? await this.filesService.savePreCompressedFile(bufferData, extension)
				: await this.filesService.saveBufferFile(bufferData, extension);

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
			// Pass compressor for immediate compression during caching (memory optimization)
			if (useNetworkInterception && !useScreenshotMode) {
				networkInterceptor = new NetworkInterceptor(
					page,
					{ blacklistTerms, whitelistTerms },
					this.imageCompressor, // Compress images as they are intercepted
				);
				await networkInterceptor.startInterception();
				this.logger.debug('Network interception enabled with immediate compression');
			}

			// Navigate to the page
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for title to be present
			await page.waitForFunction(() => document.title.length > 0, {
				timeout: 10000,
			});

			// Execute pre-scraping script
			await this.executeCustomScript(page, preScript);

			// Scroll para carregar imagens lazy-loaded (apenas se NÃO for screenshot mode)
			// No screenshot mode, o ElementScreenshot já faz seu próprio scroll agressivo
			let scrollResult = { processedImageCount: 0, failedImageCount: 0, failedImages: [] as string[] };
			if (!useScreenshotMode) {
				const scroller = new PageScroller(page, { imageSelector: selector });
				scrollResult = await scroller.scrollAndWait();
			}

			// Execute post-scraping script
			await this.executeCustomScript(page, posScript);

			// Stop interception, wait for compressions, and log stats
			if (networkInterceptor) {
				networkInterceptor.stopInterception();
				await networkInterceptor.waitForCompressions();
				const stats = networkInterceptor.getStats();
				this.logger.log(
					`Network cache: ${stats.count} images (${stats.compressedCount} compressed), ${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB`,
				);
			}

			let successfulPaths: (string | null)[];

			if (useScreenshotMode) {
				// Screenshot mode: captura elementos como PNG (máxima qualidade)
				this.logger.log('📸 Using screenshot mode for image capture (PNG, lossless)');
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
	 * Captura elementos como screenshots JPEG para máxima velocidade
	 * Otimizado baseado no fluxo Python que é 10x mais rápido
	 */
	private async captureElementsAsScreenshots(
		page: Page,
		selector: string,
		minPages: number,
	): Promise<(string | null)[]> {
		const elementScreenshot = new ElementScreenshot(page, {
			selector,
			format: 'png', // PNG para máxima qualidade (compressão será feita depois)
			minSize: 50, // Ignora elementos < 50px
			scrollWaitMs: 300, // Espera após scroll para renderização
			scrollPauseMs: 1000, // 1s entre scrolls (igual ao Python: time.sleep(1))
		});

		const count = await elementScreenshot.getElementCount();

		if (count <= minPages) {
			return [];
		}

		this.logger.log(`Found ${count} elements. Capturing PNG screenshots...`);

		// Usa Buffer diretamente em vez de base64 para melhor performance
		const screenshots = await elementScreenshot.captureAllAsBuffers();
		const results: (string | null)[] = [];

		for (const buffer of screenshots) {
			try {
				const savedPath = await this.filesService.saveBufferFile(buffer, '.png');
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
			// Setup network interception with immediate compression
			if (useNetworkInterception) {
				networkInterceptor = new NetworkInterceptor(
					page,
					{ blacklistTerms, whitelistTerms },
					this.imageCompressor,
				);
				await networkInterceptor.startInterception();
			}

			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for compressions to complete
			await networkInterceptor?.waitForCompressions();

			// Try to get from cache first (using Buffer for efficiency)
			let bufferData: Buffer | null = null;
			let extension: string = '.jpg';
			let isPreCompressed = false;

			if (networkInterceptor) {
				if (networkInterceptor.hasImage(imageUrl)) {
					bufferData = networkInterceptor.getCachedImageAsBuffer(imageUrl);
					extension = networkInterceptor.getExtension(imageUrl);
					isPreCompressed = networkInterceptor.isCompressed(imageUrl);
				} else {
					this.logger.warn(`Image not found in network cache: ${imageUrl}`);
				}
			} else {
				const imageDownloader = new ImageDownloader(page);
				bufferData = await imageDownloader.fetchImageAsBuffer(imageUrl);

				if (!bufferData) {
					this.logger.debug(`Retrying with page context fetch: ${imageUrl}`);
					bufferData = await imageDownloader.fetchImageViaPageContext(imageUrl);
				}
				extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
			}

			if (!bufferData) {
				throw new Error(`Failed to download image: ${imageUrl}`);
			}

			return isPreCompressed
				? this.filesService.savePreCompressedFile(bufferData, extension)
				: this.filesService.saveBufferFile(bufferData, extension);
		} catch (error) {
			this.logger.error('Error during scraping process.', error);
			throw error;
		} finally {
			networkInterceptor?.clearCache();
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	async fetchImageBuffer(pageUrl: string, imageUrl: string): Promise<Buffer> {
		const config = await this.getWebsiteConfig(pageUrl);
		const { concurrencyLimit, blacklistTerms, whitelistTerms, useNetworkInterception } = config;
		const domain = new URL(pageUrl).hostname;

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		const { context, page } = await this.createPageWithContext();
		let networkInterceptor: NetworkInterceptor | undefined;

		try {
			// Setup network interception with immediate compression
			if (useNetworkInterception) {
				networkInterceptor = new NetworkInterceptor(
					page,
					{ blacklistTerms, whitelistTerms },
					this.imageCompressor,
				);
				await networkInterceptor.startInterception();
			}

			await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for compressions to complete
			await networkInterceptor?.waitForCompressions();

			// Try to get from cache first (using Buffer for efficiency)
			let bufferData: Buffer | null = null;

			if (networkInterceptor) {
				// If not in cache, try to force load it via DOM to trigger network request
				if (!networkInterceptor.hasImage(imageUrl)) {
					this.logger.debug(`Image not in cache, forcing load via DOM: ${imageUrl}`);
					try {
						await page.evaluate(async (url) => {
							await new Promise<void>((resolve) => {
								const img = new Image();
								img.src = url;
								img.style.display = 'none';
								img.onload = () => resolve();
								img.onerror = () => resolve(); // Resolve anyway, interceptor might catch it
								document.body.appendChild(img);
							});
						}, imageUrl);

						// Give some time for the interceptor to process the response
						await page.waitForTimeout(1000);
						await networkInterceptor.waitForCompressions();
					} catch (e) {
						this.logger.warn(`Failed to force load image via DOM: ${e.message}`);
					}
				}

				if (networkInterceptor.hasImage(imageUrl)) {
					bufferData = networkInterceptor.getCachedImageAsBuffer(imageUrl);
				} else {
					this.logger.warn(`Image not found in network cache even after force load: ${imageUrl}`);
				}
			} else {
				const imageDownloader = new ImageDownloader(page);
				bufferData = await imageDownloader.fetchImageAsBuffer(imageUrl);

				if (!bufferData) {
					this.logger.debug(`Retrying with page context fetch: ${imageUrl}`);
					bufferData = await imageDownloader.fetchImageViaPageContext(imageUrl);
				}
			}

			if (!bufferData) {
				throw new Error(`Failed to download image: ${imageUrl}`);
			}

			return bufferData;
		} catch (error) {
			this.logger.error('Error fetching image buffer.', error);
			throw error;
		} finally {
			networkInterceptor?.clearCache();
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	/**
	 * Downloads multiple specific images by their URLs.
	 * This method directly fetches the provided image URLs without page navigation or scrolling.
	 * Used for downloading cover images and other specific image URLs.
	 */
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
			// Setup network interception with immediate compression
			if (useNetworkInterception) {
				networkInterceptor = new NetworkInterceptor(
					page,
					{ blacklistTerms, whitelistTerms },
					this.imageCompressor,
				);
				await networkInterceptor.startInterception();
			}

			// Navigate to the origin URL to establish cookies/session and Referer header
			await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Wait for compressions to complete
			await networkInterceptor?.waitForCompressions();

			const imageDownloader = new ImageDownloader(page);
			const results: (string | null)[] = [];

			// Download each specific image URL
			for (const imageUrl of imageUrls) {
				try {
					let bufferData: Buffer | null = null;
					let extension: string = '.jpg';
					let isPreCompressed = false;

					if (networkInterceptor) {
						// If not in cache, try to force load it via DOM to trigger network request
						if (!networkInterceptor.hasImage(imageUrl)) {
							this.logger.debug(`Image not in cache, forcing load via DOM: ${imageUrl}`);
							try {
								await page.evaluate(async (url) => {
									await new Promise<void>((resolve) => {
										const img = new Image();
										img.src = url;
										img.style.display = 'none';
										img.onload = () => resolve();
										img.onerror = () => resolve(); // Resolve anyway, interceptor might catch it
										document.body.appendChild(img);
									});
								}, imageUrl);

								// Give some time for the interceptor to process the response
								await page.waitForTimeout(1000);
								await networkInterceptor.waitForCompressions();
							} catch (e) {
								this.logger.warn(`Failed to force load image via DOM: ${e.message}`);
							}
						}

						if (networkInterceptor.hasImage(imageUrl)) {
							bufferData = networkInterceptor.getCachedImageAsBuffer(imageUrl);
							extension = networkInterceptor.getExtension(imageUrl);
							isPreCompressed = networkInterceptor.isCompressed(imageUrl);
						} else {
							this.logger.warn(`Image not found in network cache even after force load: ${imageUrl}`);
						}
					}

					// Fallback if network interceptor failed or wasn't used
					if (!bufferData) {
						// Try direct fetch first, fallback to page context fetch if 403
						bufferData = await imageDownloader.fetchImageAsBuffer(imageUrl);

						// If direct fetch failed (likely 403), try via page context which inherits Referer
						if (!bufferData) {
							this.logger.debug(`Retrying with page context fetch: ${imageUrl}`);
							bufferData = await imageDownloader.fetchImageViaPageContext(imageUrl);
						}
						extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
					}

					if (!bufferData) {
						this.logger.warn(`Failed to download image: ${imageUrl}`);
						results.push(null);
						continue;
					}

					const saved = isPreCompressed
						? await this.filesService.savePreCompressedFile(bufferData, extension)
						: await this.filesService.saveBufferFile(bufferData, extension);
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

	/**
	 * Faz scraping das informações do livro (capas e capítulos).
	 * @param bookUrl URL da página do livro
	 * @returns Objeto com covers (array de capas com url e title) e chapters (lista de capítulos)
	 */
	async scrapeBookInfo(bookUrl: string): Promise<{ covers?: { url: string; title?: string }[]; chapters: { title: string; url: string; index: number; isFinal?: boolean }[] }> {
		const config = await this.getWebsiteConfig(bookUrl);
		const { chapterListSelector, bookInfoExtractScript, concurrencyLimit, preScript } = config;
		const domain = new URL(bookUrl).hostname;

		if (!chapterListSelector && !bookInfoExtractScript) {
			this.logger.warn(`No book info configuration for domain: ${domain}`);
			return { chapters: [] };
		}

		await this.concurrencyManager.acquire(domain, concurrencyLimit);

		const { context, page } = await this.createPageWithContext();

		try {
			await page.goto(bookUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

			// Aguarda título carregar
			await page.waitForFunction(() => document.title.length > 0, {
				timeout: 10000,
			});

			// Executa script de pré-processamento se existir
			await this.executeCustomScript(page, preScript);

			let result: { covers?: { url: string; title?: string }[]; chapters: { title: string; url: string; index: number; isFinal?: boolean }[] } = { chapters: [] };

			if (bookInfoExtractScript) {
				// Usa script unificado para extrair todas as informações
				try {
					const rawResult = await page.evaluate(bookInfoExtractScript) as {
						covers?: Array<string | { url: string; title?: string }>;
						cover?: string | { url: string; title?: string };
						chapters?: unknown[]
					};
					// Valida a estrutura do resultado
					if (!rawResult || typeof rawResult !== 'object') {
						throw new Error('Script must return an object');
					}

					// Normaliza covers para o formato { url, title }
					let normalizedCovers: { url: string; title?: string }[] = [];
					if (Array.isArray(rawResult.covers)) {
						normalizedCovers = rawResult.covers.map((c, i) => {
							if (typeof c === 'string') {
								return { url: c, title: `Capa ${i + 1}` };
							}
							return { url: c.url, title: c.title || `Capa ${i + 1}` };
						}).filter(c => c.url);
					} else if (rawResult.cover) {
						if (typeof rawResult.cover === 'string') {
							normalizedCovers = [{ url: rawResult.cover, title: 'Capa Principal' }];
						} else {
							normalizedCovers = [{ url: rawResult.cover.url, title: rawResult.cover.title || 'Capa Principal' }];
						}
					}

					result = {
						covers: normalizedCovers,
						chapters: Array.isArray(rawResult.chapters) ? rawResult.chapters as { title: string; url: string; index: number; isFinal?: boolean }[] : [],
					};
				} catch (error) {
					this.logger.error(`Error executing bookInfoExtractScript: ${error.message}`);
				}
			} else if (chapterListSelector) {
				// Fallback: Usa seletor CSS padrão apenas para capítulos
				const chapters = await page.evaluate((selector) => {
					const elements = document.querySelectorAll(selector);
					return Array.from(elements).map((el, index, arr) => {
						const anchor = el.tagName === 'A' ? el as HTMLAnchorElement : el.querySelector('a');
						return {
							title: el.textContent?.trim() || `Chapter ${index + 1}`,
							url: anchor?.href || '',
							index: index + 1,
							isFinal: index === arr.length - 1,
						};
					}).filter(ch => ch.url);
				}, chapterListSelector);
				result = { chapters };
			}

			this.logger.log(`Found ${result.chapters.length} chapters on ${bookUrl}${result.covers?.length ? ` (with ${result.covers.length} covers)` : ''}`);
			return result;
		} catch (error) {
			this.logger.error(`Error scraping book info from ${bookUrl}: ${error.message}`);
			throw error;
		} finally {
			await this.closeContext(context);
			this.concurrencyManager.release(domain);
		}
	}

	/**
	 * @deprecated Use scrapeBookInfo instead
	 * Faz scraping da lista de capítulos de um livro.
	 * @param bookUrl URL da página do livro
	 * @returns Lista de capítulos encontrados com título, URL e índice
	 */
	async scrapeChapterList(bookUrl: string): Promise<{ title: string; url: string; index: number }[]> {
		const result = await this.scrapeBookInfo(bookUrl);
		return result.chapters;
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
