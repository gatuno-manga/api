import * as path from 'node:path';
import {
	Inject,
	Injectable,
	Logger,
	OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { Browser, BrowserContext, Page } from 'playwright';
import { AppConfigService } from 'src/app-config/app-config.service';
import { FilesService } from 'src/files/files.service';
import { REDIS_CLIENT } from 'src/redis/redis.constants';
import { PlaywrightBrowserFactory } from './browser';
import { IConcurrencyManager, RedisConcurrencyManager } from './concurrency';
import { WebsiteConfigDto } from './dto/website-config.dto';
import {
	CookieConfig,
	ElementScreenshot,
	ImageCompressor,
	ImageDownloader,
	NetworkInterceptor,
	PageScroller,
	StorageConfig,
	StorageInjector,
} from './helpers';
import {
	detectPageComplexity,
	getComplexityMultipliers,
	PageSize,
} from './helpers/page-complexity-detector';
import {
	DEFAULT_SCROLL_CONFIG,
	getAdaptiveScrollConfig,
} from './helpers/page-scroller';
import { ScrapingContext } from './runner/scraping-context.interface';
import { ScrapingSessionRunner } from './runner/scraping-session.runner';
import { WebsiteService } from './website.service';

@Injectable()
export class ScrapingService implements OnApplicationShutdown {
	readonly logger = new Logger(ScrapingService.name);
	concurrencyManager: IConcurrencyManager;
	private imageCompressor: ImageCompressor | undefined;
	private runner: ScrapingSessionRunner;

	constructor(
		private readonly appConfigService: AppConfigService,
		private readonly filesService: FilesService,
		private readonly webSiteService: WebsiteService,
		private readonly browserFactory: PlaywrightBrowserFactory,
		@Inject(REDIS_CLIENT) private readonly redis: Redis,
	) {
		this.initializeImageCompressor();
		this.initializeConcurrencyManager();
		this.runner = new ScrapingSessionRunner(
			this.browserFactory,
			this.concurrencyManager,
			this.imageCompressor,
		);

		if (this.appConfigService.playwright.debugMode) {
			this.logger.log('🔍 Playwright DEBUG mode enabled');
		}
		this.logger.debug('Scraping service initialized');
	}

	private initializeConcurrencyManager(): void {
		this.concurrencyManager = new RedisConcurrencyManager(this.redis, {
			slotTtlMs: 1_200_000,
			pollIntervalMs: 500,
			maxWaitMs: 3_600_000,
		});
		this.logger.log('✅ Redis concurrency manager initialized');
	}

	private initializeImageCompressor(): void {
		const compressorFactory = this.filesService.getCompressorFactory();

		this.imageCompressor = {
			compress: (buffer: Buffer) =>
				compressorFactory
					.compress(buffer, '.jpg')
					.then((r) => r.buffer),
			getOutputExtension: (ext: string) => {
				const compressor = compressorFactory.getCompressor(ext);
				return compressor?.getOutputExtension(ext) ?? ext;
			},
		};

		this.logger.debug(
			'Image compressor initialized for network interception',
		);
	}

	setConcurrencyManager(manager: IConcurrencyManager): void {
		this.concurrencyManager = manager;
		// Re-create runner if dependencies change
		this.runner = new ScrapingSessionRunner(
			this.browserFactory,
			this.concurrencyManager,
			this.imageCompressor,
		);
		this.logger.debug('Concurrency manager replaced');
	}

	setBrowserFactory(factory: PlaywrightBrowserFactory): void {
		this.runner = new ScrapingSessionRunner(
			factory,
			this.concurrencyManager,
			this.imageCompressor,
		);
		this.logger.debug('Browser factory replaced');
	}

	public async getWebsiteConfig(url: string): Promise<WebsiteConfigDto> {
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
		let cookies: CookieConfig[] | undefined;
		let localStorage: Record<string, string> | undefined;
		let sessionStorage: Record<string, string> | undefined;
		let reloadAfterStorageInjection: boolean | undefined;
		let enableAdaptiveTimeouts = true;
		let timeoutMultipliers: Record<string, number> | undefined;

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
			cookies = website.cookies || undefined;
			localStorage = website.localStorage || undefined;
			sessionStorage = website.sessionStorage || undefined;
			reloadAfterStorageInjection =
				website.reloadAfterStorageInjection ?? false;
			enableAdaptiveTimeouts = website.enableAdaptiveTimeouts ?? true;
			timeoutMultipliers = website.timeoutMultipliers || undefined;
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
			cookies,
			localStorage,
			sessionStorage,
			reloadAfterStorageInjection,
			enableAdaptiveTimeouts,
			timeoutMultipliers,
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
			let extension = '.jpg';
			let isPreCompressed = false;

			if (networkInterceptor) {
				if (networkInterceptor.hasImage(imageUrl)) {
					bufferData =
						await networkInterceptor.getCachedImageAsBuffer(
							imageUrl,
						);
					extension = networkInterceptor.getExtension(imageUrl);
					isPreCompressed = networkInterceptor.isCompressed(imageUrl);
					this.logger.debug(
						`Cache hit for: ${imageUrl} (compressed: ${isPreCompressed})`,
					);
				} else {
					this.logger.warn(
						`Image not found in network cache: ${imageUrl}`,
					);
				}
			} else {
				bufferData = await imageDownloader.fetchImageAsBuffer(imageUrl);
				if (!bufferData) {
					this.logger.debug(
						`Retrying with page context fetch: ${imageUrl}`,
					);
					bufferData =
						await imageDownloader.fetchImageViaPageContext(
							imageUrl,
						);
				}
				extension = path.extname(new URL(imageUrl).pathname) || '.jpg';
				this.logger.debug(`Cache miss, fetched: ${imageUrl}`);
			}

			if (!bufferData) {
				results.push(null);
				continue;
			}

			const savedPath = isPreCompressed
				? await this.filesService.savePreCompressedFile(
						bufferData,
						extension,
					)
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
			blacklistTerms,
			whitelistTerms,
			useScreenshotMode,
		} = config;

		return this.runner.run(
			url,
			config,
			async ({ page, networkInterceptor }) => {
				if (selector && selector !== 'img') {
					this.logger.debug(`Waiting for selector: ${selector}`);
					await page
						.waitForSelector(selector, { timeout: 15000 })
						.catch(() => {
							this.logger.debug(
								`Selector "${selector}" not found within timeout, proceeding anyway`,
							);
						});
				}

				await this.executeCustomScript(page, preScript);

				const pageComplexity = await detectPageComplexity(
					page,
					selector,
				);
				this.logger.log(
					`📊 Página: ${pageComplexity.scrollHeight}px (${pageComplexity.scrollRatio.toFixed(1)}x viewport), ` +
						`${pageComplexity.elementCount} elementos, tamanho: ${pageComplexity.pageSize}`,
				);

				const multipliers = config.enableAdaptiveTimeouts
					? getComplexityMultipliers(
							pageComplexity,
							config.timeoutMultipliers as
								| Record<PageSize, number>
								| undefined,
						)
					: {
							delayMultiplier: 1,
							stabilityMultiplier: 1,
							timeoutMultiplier: 1,
							scrollStep: 1200,
						};

				let scrollResult = { failedImages: [] as string[] };

				if (!useScreenshotMode) {
					const adaptiveConfig = getAdaptiveScrollConfig(
						{ ...DEFAULT_SCROLL_CONFIG, imageSelector: selector },
						multipliers,
					);
					const scroller = new PageScroller(page, adaptiveConfig);
					scrollResult = await scroller.scrollAndWait();
				}

				await this.executeCustomScript(page, posScript);

				if (networkInterceptor) {
					networkInterceptor.stopInterception();
					await networkInterceptor.waitForCompressions();
				}

				if (useScreenshotMode) {
					this.logger.log(
						'📸 Using screenshot mode for image capture (PNG, lossless)',
					);
					const adaptiveParams = {
						scrollPauseMs: Math.ceil(
							1000 * multipliers.delayMultiplier,
						),
						scrollWaitMs: Math.ceil(
							300 * multipliers.delayMultiplier,
						),
					};
					return await this.captureElementsAsScreenshots(
						page,
						selector,
						pages,
						adaptiveParams,
					);
				}

				const imageDownloader = new ImageDownloader(page, {
					blacklistTerms,
					whitelistTerms,
				});
				const imageUrls = await imageDownloader.getImageUrls(selector);

				if (imageUrls.length <= pages) {
					return null;
				}

				this.logger.log(
					`Found ${imageUrls.length} valid image URLs. Starting downloads.`,
				);

				const successfulPaths = await this.downloadAndSaveImages(
					imageDownloader,
					imageUrls,
					scrollResult.failedImages,
					networkInterceptor,
				);

				return successfulPaths.filter(
					(path): path is string => path !== null,
				);
			},
		);
	}

	private async captureElementsAsScreenshots(
		page: Page,
		selector: string,
		minPages: number,
		pageComplexity?: { scrollPauseMs: number; scrollWaitMs: number },
	): Promise<string[]> {
		const scrollPauseMs = pageComplexity?.scrollPauseMs ?? 1000;
		const scrollWaitMs = pageComplexity?.scrollWaitMs ?? 300;

		const elementScreenshot = new ElementScreenshot(page, {
			selector,
			format: 'png',
			minSize: 50,
			scrollWaitMs,
			scrollPauseMs,
		});

		const count = await elementScreenshot.getElementCount();

		if (count <= minPages) {
			return [];
		}

		this.logger.log(
			`Found ${count} elements. Capturing PNG screenshots...`,
		);

		const screenshots = await elementScreenshot.captureAllAsBuffers();
		const results: (string | null)[] = [];

		for (const buffer of screenshots) {
			try {
				const savedPath = await this.filesService.saveBufferFile(
					buffer,
					'.png',
				);
				results.push(savedPath);
			} catch (error) {
				this.logger.warn('Failed to save screenshot', error);
				results.push(null);
			}
		}

		const successfulScreenshots = results.filter(
			(path): path is string => path !== null,
		);

		this.logger.log(
			`Captured ${successfulScreenshots.length}/${count} screenshots`,
		);
		return successfulScreenshots;
	}

	async scrapeSingleImage(url: string, imageUrl: string): Promise<string> {
		const config = await this.getWebsiteConfig(url);

		return this.runner.run(
			url,
			config,
			async ({ page, networkInterceptor }) => {
				await networkInterceptor?.waitForCompressions();

				let bufferData: Buffer | null = null;
				let extension = '.jpg';
				let isPreCompressed = false;

				if (networkInterceptor) {
					if (networkInterceptor.hasImage(imageUrl)) {
						bufferData =
							await networkInterceptor.getCachedImageAsBuffer(
								imageUrl,
							);
						extension = networkInterceptor.getExtension(imageUrl);
						isPreCompressed =
							networkInterceptor.isCompressed(imageUrl);
					} else {
						this.logger.warn(
							`Image not found in network cache: ${imageUrl}`,
						);
					}
				} else {
					const imageDownloader = new ImageDownloader(page);
					bufferData =
						await imageDownloader.fetchImageAsBuffer(imageUrl);

					if (!bufferData) {
						this.logger.debug(
							`Retrying with page context fetch: ${imageUrl}`,
						);
						bufferData =
							await imageDownloader.fetchImageViaPageContext(
								imageUrl,
							);
					}
					extension =
						path.extname(new URL(imageUrl).pathname) || '.jpg';
				}

				if (!bufferData) {
					throw new Error(`Failed to download image: ${imageUrl}`);
				}

				return isPreCompressed
					? this.filesService.savePreCompressedFile(
							bufferData,
							extension,
						)
					: this.filesService.saveBufferFile(bufferData, extension);
			},
		);
	}

	async fetchImageBuffer(pageUrl: string, imageUrl: string): Promise<Buffer> {
		const config = await this.getWebsiteConfig(pageUrl);

		return this.runner.run(
			pageUrl,
			config,
			async ({ page, networkInterceptor }) => {
				await networkInterceptor?.waitForCompressions();

				let bufferData: Buffer | null = null;

				if (networkInterceptor) {
					if (!networkInterceptor.hasImage(imageUrl)) {
						this.logger.debug(
							`Image not in cache, forcing load via DOM: ${imageUrl}`,
						);
						try {
							await this.forceLoadImage(page, imageUrl);
							await networkInterceptor.waitForCompressions();
						} catch (e) {
							this.logger.warn(
								`Failed to force load image via DOM: ${e.message}`,
							);
						}
					}

					if (networkInterceptor.hasImage(imageUrl)) {
						bufferData =
							await networkInterceptor.getCachedImageAsBuffer(
								imageUrl,
							);
					} else {
						this.logger.warn(
							`Image not found in network cache even after force load: ${imageUrl}`,
						);
					}
				} else {
					const imageDownloader = new ImageDownloader(page);
					bufferData =
						await imageDownloader.fetchImageAsBuffer(imageUrl);

					if (!bufferData) {
						this.logger.debug(
							`Retrying with page context fetch: ${imageUrl}`,
						);
						bufferData =
							await imageDownloader.fetchImageViaPageContext(
								imageUrl,
							);
					}
				}

				if (!bufferData) {
					throw new Error(`Failed to download image: ${imageUrl}`);
				}

				return bufferData;
			},
		);
	}

	private async forceLoadImage(page: Page, imageUrl: string): Promise<void> {
		await page.evaluate(async (url) => {
			await new Promise<void>((resolve) => {
				const img = new Image();
				img.src = url;
				img.style.display = 'none';
				img.onload = () => resolve();
				img.onerror = () => resolve();
				document.body.appendChild(img);
			});
		}, imageUrl);
		await page.waitForTimeout(1000);
	}

	async scrapeMultipleImages(
		url: string,
		imageUrls: string[],
	): Promise<(string | null)[]> {
		const config = await this.getWebsiteConfig(url);

		return this.runner.run(
			url,
			config,
			async ({ page, networkInterceptor }) => {
				await networkInterceptor?.waitForCompressions();

				const imageDownloader = new ImageDownloader(page);
				const results: (string | null)[] = [];

				for (const imageUrl of imageUrls) {
					try {
						let bufferData: Buffer | null = null;
						let extension = '.jpg';
						let isPreCompressed = false;

						if (networkInterceptor) {
							if (!networkInterceptor.hasImage(imageUrl)) {
								this.logger.debug(
									`Image not in cache, forcing load via DOM: ${imageUrl}`,
								);
								try {
									await this.forceLoadImage(page, imageUrl);
									await networkInterceptor.waitForCompressions();
								} catch (e) {
									this.logger.warn(
										`Failed to force load image via DOM: ${e.message}`,
									);
								}
							}

							if (networkInterceptor.hasImage(imageUrl)) {
								bufferData =
									await networkInterceptor.getCachedImageAsBuffer(
										imageUrl,
									);
								extension =
									networkInterceptor.getExtension(imageUrl);
								isPreCompressed =
									networkInterceptor.isCompressed(imageUrl);
							} else {
								this.logger.warn(
									`Image not found in network cache even after force load: ${imageUrl}`,
								);
							}
						}

						if (!bufferData) {
							bufferData =
								await imageDownloader.fetchImageAsBuffer(
									imageUrl,
								);

							if (!bufferData) {
								this.logger.debug(
									`Retrying with page context fetch: ${imageUrl}`,
								);
								bufferData =
									await imageDownloader.fetchImageViaPageContext(
										imageUrl,
									);
							}
							extension =
								path.extname(new URL(imageUrl).pathname) ||
								'.jpg';
						}

						if (!bufferData) {
							this.logger.warn(
								`Failed to download image: ${imageUrl}`,
							);
							results.push(null);
							continue;
						}

						const saved = isPreCompressed
							? await this.filesService.savePreCompressedFile(
									bufferData,
									extension,
								)
							: await this.filesService.saveBufferFile(
									bufferData,
									extension,
								);
						results.push(saved);
					} catch (err) {
						this.logger.warn(
							`Error processing image ${imageUrl}`,
							err,
						);
						results.push(null);
					}
				}

				return results;
			},
		);
	}

	async scrapeBookInfo(bookUrl: string): Promise<{
		covers?: { url: string; title?: string }[];
		chapters: {
			title: string;
			url: string;
			index: number;
			isFinal?: boolean;
		}[];
	}> {
		const config = await this.getWebsiteConfig(bookUrl);
		const { chapterListSelector, bookInfoExtractScript, preScript } =
			config;

		if (!chapterListSelector && !bookInfoExtractScript) {
			const domain = new URL(bookUrl).hostname;
			this.logger.warn(
				`No book info configuration for domain: ${domain}`,
			);
			return { chapters: [] };
		}

		return this.runner.run(bookUrl, config, async ({ page }) => {
			if (chapterListSelector) {
				this.logger.debug(
					`Waiting for chapter selector: ${chapterListSelector}`,
				);
				await page
					.waitForSelector(chapterListSelector, { timeout: 15000 })
					.catch(() => {
						this.logger.debug(
							`Chapter selector "${chapterListSelector}" not found within timeout`,
						);
					});
			}

			await this.executeCustomScript(page, preScript);

			let result: {
				covers?: { url: string; title?: string }[];
				chapters: {
					title: string;
					url: string;
					index: number;
					isFinal?: boolean;
				}[];
			} = { chapters: [] };

			if (bookInfoExtractScript) {
				try {
					const rawResult = await page.evaluate(
						bookInfoExtractScript,
					);
					if (!rawResult || typeof rawResult !== 'object') {
						throw new Error('Script must return an object');
					}

					const typedResult = rawResult as {
						covers?: ({ url: string; title?: string } | string)[];
						cover?: { url: string; title?: string } | string;
						chapters?: {
							title: string;
							url: string;
							index: number;
							isFinal?: boolean;
						}[];
					};
					let normalizedCovers: { url: string; title?: string }[] =
						[];

					if (Array.isArray(typedResult.covers)) {
						normalizedCovers = typedResult.covers
							.map((c, i) => {
								if (typeof c === 'string')
									return { url: c, title: `Capa ${i + 1}` };
								return {
									url: c.url,
									title: c.title || `Capa ${i + 1}`,
								};
							})
							.filter((c) => c.url);
					} else if (typedResult.cover) {
						normalizedCovers = [
							typeof typedResult.cover === 'string'
								? {
										url: typedResult.cover,
										title: 'Capa Principal',
									}
								: {
										url: typedResult.cover.url,
										title:
											typedResult.cover.title ||
											'Capa Principal',
									},
						];
					}

					result = {
						covers: normalizedCovers,
						chapters: Array.isArray(typedResult.chapters)
							? typedResult.chapters
							: [],
					};
				} catch (error) {
					this.logger.error(
						`Error executing bookInfoExtractScript: ${error.message}`,
					);
				}
			} else if (chapterListSelector) {
				const chapters = await page.evaluate((selector) => {
					const elements = document.querySelectorAll(selector);
					return Array.from(elements)
						.map((el, index, arr) => {
							const anchor =
								el.tagName === 'A'
									? (el as HTMLAnchorElement)
									: el.querySelector('a');
							return {
								title:
									el.textContent?.trim() ||
									`Chapter ${index + 1}`,
								url: anchor?.href || '',
								index: index + 1,
								isFinal: index === arr.length - 1,
							};
						})
						.filter((ch) => ch.url);
				}, chapterListSelector);
				result = { chapters };
			}

			this.logger.log(
				`Found ${result.chapters.length} chapters on ${bookUrl}${result.covers?.length ? ` (with ${result.covers.length} covers)` : ''}`,
			);
			return result;
		});
	}

	async scrapeChapterList(
		bookUrl: string,
	): Promise<{ title: string; url: string; index: number }[]> {
		const result = await this.scrapeBookInfo(bookUrl);
		return result.chapters;
	}

	async onApplicationShutdown(): Promise<void> {
		this.logger.log('🛑 Shutting down scraping service...');

		// Gracefully shutdown browser factory and pool
		try {
			await Promise.race([
				this.browserFactory.shutdown(),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error('Shutdown timeout')),
						30000,
					),
				),
			]);
			this.logger.log('✅ Scraping service shutdown complete');
		} catch (error) {
			this.logger.error(
				`Error during scraping service shutdown: ${error.message}`,
			);
		}
	}
}
