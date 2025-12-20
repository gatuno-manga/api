import { Injectable, Logger } from '@nestjs/common';
import { chromium as playwrightChromium } from 'playwright-extra';
import type { Browser, BrowserContext, Page } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { IBrowserFactory } from './browser.factory.interface';
import {
    BrowserConfig,
    DEFAULT_BROWSER_CONFIG,
} from './browser-config.interface';

/**
 * Factory for creating Playwright browser instances with stealth mode.
 * Uses playwright-extra with stealth plugin to avoid bot detection.
 */
@Injectable()
export class PlaywrightBrowserFactory implements IBrowserFactory {
    private readonly logger = new Logger(PlaywrightBrowserFactory.name);
    private readonly config: Required<BrowserConfig>;
    private stealthInitialized = false;

    constructor(config?: Partial<BrowserConfig>) {
        this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
        this.initializeStealth();
    }

    private initializeStealth(): void {
        if (this.config.stealth && !this.stealthInitialized) {
            playwrightChromium.use(StealthPlugin());
            this.stealthInitialized = true;
            this.logger.debug('Stealth plugin initialized');
        }
    }

    async launch(): Promise<Browser> {
        this.logger.debug('Launching browser...');

        // Se wsEndpoint estiver configurado, tenta conectar a um browser remoto via CDP
        if (this.config.wsEndpoint) {
            try {
                this.logger.debug(`Attempting to connect to remote browser via CDP at ${this.config.wsEndpoint}`);
                const { chromium } = await import('playwright');
                const browser = await chromium.connectOverCDP(this.config.wsEndpoint, {
                    timeout: 5000, // 5 segundos de timeout para conexão
                });
                this.logger.debug('Connected to remote browser via CDP');
                return browser;
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : String(error);
                this.logger.warn(
                    `Failed to connect to remote browser at ${this.config.wsEndpoint}, falling back to local browser: ${errorMessage}`,
                );
                // Fallback para browser local
            }
        }

        // Configuração para modo debug (browser visível)
        const isDebug = this.config.debugMode;
        const headless = isDebug ? false : this.config.headless;
        const slowMo = isDebug ? (this.config.slowMo || 100) : this.config.slowMo;

        if (isDebug) {
            this.logger.log('🔍 Debug mode enabled - browser will be visible');
        }

        const browser = await playwrightChromium.launch({
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

        this.logger.debug('Browser launched successfully');
        return browser;
    }

    async createContext(browser: Browser): Promise<BrowserContext> {
        this.logger.debug('Creating browser context...');

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
                window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
                    parameters.name === 'notifications'
                        ? Promise.resolve({
                            state: Notification.permission,
                        } as PermissionStatus)
                        : originalQuery(parameters);

                // Add chrome runtime
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (!(window as any).chrome) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (window as any).chrome = {
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

    getConfig(): Required<BrowserConfig> {
        return { ...this.config };
    }
}
