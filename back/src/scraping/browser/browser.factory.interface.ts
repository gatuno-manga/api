import { Browser, BrowserContext, Page } from 'playwright';

/**
 * Interface for browser factory implementations.
 * Allows creation of browser instances with stealth configuration.
 */
export interface IBrowserFactory {
    /**
     * Launch a new browser instance.
     */
    launch(): Promise<Browser>;

    /**
     * Create a new browser context with stealth settings.
     */
    createContext(browser: Browser): Promise<BrowserContext>;

    /**
     * Create a new page in the given context.
     */
    createPage(context: BrowserContext): Promise<Page>;
}
