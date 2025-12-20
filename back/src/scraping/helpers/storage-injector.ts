import { Logger } from '@nestjs/common';
import type { BrowserContext, Page } from 'playwright';

/**
 * Cookie configuration for injection into browser context.
 */
export interface CookieConfig {
    name: string;
    value: string;
    /** Domain for the cookie. If omitted, uses the page's domain */
    domain?: string;
    /** Path for the cookie. Default: '/' */
    path?: string;
    /** Whether the cookie is secure (HTTPS only) */
    secure?: boolean;
    /** Whether the cookie is HTTP-only */
    httpOnly?: boolean;
    /** SameSite attribute */
    sameSite?: 'Strict' | 'Lax' | 'None';
    /** Expiration as Unix timestamp in seconds */
    expires?: number;
}

/**
 * Storage configuration for localStorage and sessionStorage injection.
 */
export interface StorageConfig {
    /** Cookies to inject before navigation */
    cookies?: CookieConfig[];
    /** localStorage items to inject after page load */
    localStorage?: Record<string, string>;
    /** sessionStorage items to inject after page load */
    sessionStorage?: Record<string, string>;
    /** Whether to reload the page after injecting storage (some sites read configs only on load) */
    reloadAfterStorageInjection?: boolean;
}

/**
 * Helper class to inject cookies, localStorage, and sessionStorage into browser pages.
 * Useful for setting language preferences, bypassing consent popups, and configuring site behavior.
 */
export class StorageInjector {
    private readonly logger = new Logger(StorageInjector.name);

    constructor(private readonly config: StorageConfig) {}

    private normalizeStorageItems(
        items?: Record<string, unknown>,
    ): Record<string, string> {
        if (!items) return {};

        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(items)) {
            if (typeof value === 'string') {
                normalized[key] = value;
                continue;
            }

            try {
                // Prefer JSON encoding for objects/arrays/numbers/booleans
                normalized[key] = JSON.stringify(value);
            } catch {
                // Fallback: best-effort string conversion
                normalized[key] = String(value);
            }
        }
        return normalized;
    }

    /**
     * Injects cookies into the browser context.
     * Should be called BEFORE navigation for cookies to be sent with the first request.
     *
     * @param context Browser context to inject cookies into
     * @param defaultDomain Domain to use for cookies without explicit domain
     */
    async injectCookies(context: BrowserContext, defaultDomain: string): Promise<void> {
        const { cookies } = this.config;

        if (!cookies || cookies.length === 0) {
            return;
        }

        const playwrightCookies = cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || defaultDomain,
            path: cookie.path || '/',
            secure: cookie.secure ?? false,
            httpOnly: cookie.httpOnly ?? false,
            sameSite: cookie.sameSite || ('Lax' as const),
            expires: cookie.expires || Math.floor(Date.now() / 1000) + 86400 * 365, // Default: 1 year
        }));

        await context.addCookies(playwrightCookies);
        this.logger.debug(`Injected ${cookies.length} cookies for domain: ${defaultDomain}`);
    }

    /**
     * Injects localStorage items into the page.
     * Must be called AFTER the page has navigated to the target domain.
     *
     * @param page Page to inject localStorage into
     */
    async injectLocalStorage(page: Page): Promise<void> {
        const localStorage = this.normalizeStorageItems(
            this.config.localStorage as unknown as Record<string, unknown>,
        );

        if (Object.keys(localStorage).length === 0) {
            return;
        }

        await page.evaluate((items) => {
            for (const [key, value] of Object.entries(items)) {
                window.localStorage.setItem(key, value);
            }
        }, localStorage);

        this.logger.debug(`Injected ${Object.keys(localStorage).length} localStorage items`);
    }

    /**
     * Injects sessionStorage items into the page.
     * Must be called AFTER the page has navigated to the target domain.
     *
     * @param page Page to inject sessionStorage into
     */
    async injectSessionStorage(page: Page): Promise<void> {
        const sessionStorage = this.normalizeStorageItems(
            this.config.sessionStorage as unknown as Record<string, unknown>,
        );

        if (Object.keys(sessionStorage).length === 0) {
            return;
        }

        await page.evaluate((items) => {
            for (const [key, value] of Object.entries(items)) {
                window.sessionStorage.setItem(key, value);
            }
        }, sessionStorage);

        this.logger.debug(`Injected ${Object.keys(sessionStorage).length} sessionStorage items`);
    }

    /**
     * Adds an init script to apply localStorage/sessionStorage before any site scripts run.
     * This mirrors the common "set then reload" approach, but without needing a reload.
     *
     * Should be called BEFORE the first navigation to the target origin.
     */
    async addInitScriptForStorage(page: Page): Promise<void> {
        const localStorageItems = this.normalizeStorageItems(
            this.config.localStorage as unknown as Record<string, unknown>,
        );
        const sessionStorageItems = this.normalizeStorageItems(
            this.config.sessionStorage as unknown as Record<string, unknown>,
        );

        const hasLocal = Object.keys(localStorageItems).length > 0;
        const hasSession = Object.keys(sessionStorageItems).length > 0;
        if (!hasLocal && !hasSession) {
            return;
        }

        await page.addInitScript(
            ({ ls, ss }: { ls: Record<string, string>; ss: Record<string, string> }) => {
                try {
                    for (const [key, value] of Object.entries(ls)) {
                        window.localStorage.setItem(key, value);
                    }
                    for (const [key, value] of Object.entries(ss)) {
                        window.sessionStorage.setItem(key, value);
                    }
                } catch {
                    // Ignore storage errors (e.g. blocked storage)
                }
            },
            { ls: localStorageItems, ss: sessionStorageItems },
        );

        this.logger.debug(
            `Added init script for storage (localStorage: ${Object.keys(localStorageItems).length}, sessionStorage: ${Object.keys(sessionStorageItems).length})`,
        );
    }

    /**
     * Injects all storage (localStorage and sessionStorage) and optionally reloads the page.
     * Must be called AFTER the page has navigated to the target domain.
     *
     * @param page Page to inject storage into
     * @returns Whether the page was reloaded
     */
    async injectStorageAndReload(page: Page): Promise<boolean> {
        await this.injectLocalStorage(page);
        await this.injectSessionStorage(page);

        // Debug: verify what was actually set in localStorage
        if (this.config.localStorage && Object.keys(this.config.localStorage).length > 0) {
            const actualValues = await page.evaluate((keys) => {
                const result: Record<string, string | null> = {};
                for (const key of keys) {
                    const val = window.localStorage.getItem(key);
                    result[key] = val ? val.substring(0, 100) + '...' : null;
                }
                return result;
            }, Object.keys(this.config.localStorage));
            this.logger.debug(`localStorage verification: ${JSON.stringify(actualValues)}`);
        }

        const shouldReload = this.config.reloadAfterStorageInjection ?? false;
        const hasStorageItems =
            (this.config.localStorage && Object.keys(this.config.localStorage).length > 0) ||
            (this.config.sessionStorage && Object.keys(this.config.sessionStorage).length > 0);

        if (shouldReload && hasStorageItems) {
            this.logger.debug('Reloading page after storage injection');
            await page.reload({ waitUntil: 'domcontentloaded' });
            return true;
        }

        return false;
    }

    /**
     * Checks if any storage configuration is present.
     */
    hasStorageConfig(): boolean {
        return Boolean(
            (this.config.cookies && this.config.cookies.length > 0) ||
            (this.config.localStorage && Object.keys(this.config.localStorage).length > 0) ||
            (this.config.sessionStorage && Object.keys(this.config.sessionStorage).length > 0)
        );
    }

    /**
     * Gets current cookies from the context (useful for debugging).
     */
    async getCookies(context: BrowserContext, url?: string): Promise<CookieConfig[]> {
        const urls = url ? [url] : undefined;
        const cookies = await context.cookies(urls);
        return cookies.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite as 'Strict' | 'Lax' | 'None',
            expires: c.expires,
        }));
    }

    /**
     * Gets current localStorage from the page (useful for debugging).
     */
    async getLocalStorage(page: Page): Promise<Record<string, string>> {
        return page.evaluate(() => {
            const items: Record<string, string> = {};
            for (let i = 0; i < window.localStorage.length; i++) {
                const key = window.localStorage.key(i);
                if (key) {
                    items[key] = window.localStorage.getItem(key) || '';
                }
            }
            return items;
        });
    }

    /**
     * Gets current sessionStorage from the page (useful for debugging).
     */
    async getSessionStorage(page: Page): Promise<Record<string, string>> {
        return page.evaluate(() => {
            const items: Record<string, string> = {};
            for (let i = 0; i < window.sessionStorage.length; i++) {
                const key = window.sessionStorage.key(i);
                if (key) {
                    items[key] = window.sessionStorage.getItem(key) || '';
                }
            }
            return items;
        });
    }

    /**
     * Clears all storage (cookies, localStorage, sessionStorage).
     */
    async clearAll(context: BrowserContext, page: Page): Promise<void> {
        await context.clearCookies();
        await page.evaluate(() => {
            window.localStorage.clear();
            window.sessionStorage.clear();
        });
        this.logger.debug('Cleared all storage');
    }
}
