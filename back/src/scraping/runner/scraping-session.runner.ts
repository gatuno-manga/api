import { Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';
import { PlaywrightBrowserFactory } from '../browser';
import { IConcurrencyManager } from '../concurrency';
import { WebsiteConfigDto } from '../dto/website-config.dto';
import { NetworkInterceptor, StorageInjector, StorageConfig, ImageCompressor } from '../helpers';
import { ScrapingContext, ScrapingTask } from './scraping-context.interface';

export class ScrapingSessionRunner {
    private readonly logger = new Logger(ScrapingSessionRunner.name);

    constructor(
        private readonly browserFactory: PlaywrightBrowserFactory,
        private readonly concurrencyManager: IConcurrencyManager,
        private readonly imageCompressor?: ImageCompressor
    ) {}

    async run<T>(
        url: string,
        config: WebsiteConfigDto,
        task: ScrapingTask<T>
    ): Promise<T> {
        const domain = new URL(url).hostname;
        const { concurrencyLimit } = config;

        await this.concurrencyManager.acquire(domain, concurrencyLimit);

        let context: BrowserContext | null = null;
        let page: Page | null = null;
        let networkInterceptor: NetworkInterceptor | undefined;

        try {
            const browser = await this.browserFactory.launch();
            context = await this.browserFactory.createContext(browser);
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
                        whitelistTerms: config.whitelistTerms 
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
                const hasLocalStorage = config.localStorage && Object.keys(config.localStorage).length > 0;
                
                if (hasLocalStorage) {
                    await storageInjector.injectLocalStorage(page);
                    await storageInjector.injectSessionStorage(page);
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
                } else {
                    const reloaded = await storageInjector.injectStorageAndReload(page);
                    if (reloaded) {
                        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
                    }
                }
            }

            // Wait for hydration/rendering
            await page.waitForFunction(() => document.title.length > 0, { timeout: 10000 }).catch(() => undefined);

            // Execute scraping task
            const scrapingContext: ScrapingContext = {
                page,
                context,
                config,
                networkInterceptor,
                storageInjector
            };

            return await task(scrapingContext);

        } finally {
            if (networkInterceptor) {
                networkInterceptor.clearCache();
                networkInterceptor.stopInterception();
            }
            if (context) {
                await context.close().catch(e => this.logger.warn('Error closing context', e));
            }
            this.concurrencyManager.release(domain);
        }
    }

    private createStorageInjector(config: WebsiteConfigDto): StorageInjector | null {
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
