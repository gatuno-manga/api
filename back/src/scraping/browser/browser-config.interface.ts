/**
 * Configuration options for browser instances.
 */
export interface BrowserConfig {
    /**
     * Run browser in headless mode.
     * @default true
     */
    headless?: boolean;

    /**
     * Default navigation timeout in milliseconds.
     * @default 60000
     */
    navigationTimeout?: number;

    /**
     * Default action timeout in milliseconds.
     * @default 30000
     */
    actionTimeout?: number;

    /**
     * Custom user agent string.
     */
    userAgent?: string;

    /**
     * Viewport dimensions.
     */
    viewport?: {
        width: number;
        height: number;
    };

    /**
     * Directory for downloads.
     */
    downloadDir?: string;

    /**
     * Enable stealth mode to avoid bot detection.
     * @default true
     */
    stealth?: boolean;

    /**
     * Locale for the browser context.
     * @default 'pt-BR'
     */
    locale?: string;

    /**
     * Timezone ID.
     * @default 'America/Sao_Paulo'
     */
    timezoneId?: string;

    /**
     * Enable debug mode with visible browser.
     * When true, runs non-headless with slowMo for visualization.
     * @default false
     */
    debugMode?: boolean;

    /**
     * Slow down operations by specified milliseconds.
     * Useful for debugging/visualization.
     * @default 0
     */
    slowMo?: number;

    /**
     * WebSocket endpoint for remote browser connection.
     * Used for connecting to external debug server (like playwright-debug container).
     */
    wsEndpoint?: string;
}

/**
 * Default browser configuration.
 */
export const DEFAULT_BROWSER_CONFIG: Required<BrowserConfig> = {
    headless: true,
    navigationTimeout: 150000, // Aumentado de 60s para 150s para páginas longas
    actionTimeout: 30000,
    userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    downloadDir: '/usr/src/app/data',
    stealth: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    debugMode: false,
    slowMo: 0,
    wsEndpoint: '',
};
