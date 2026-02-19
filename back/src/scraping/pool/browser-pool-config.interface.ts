/**
 * Configuration for browser pool.
 */
export interface BrowserPoolConfig {
	/**
	 * Number of browsers to maintain in the pool.
	 * @default 2
	 */
	poolSize: number;

	/**
	 * Maximum number of contexts per browser.
	 * When exceeded, a new browser from the pool is used.
	 * @default 4
	 */
	maxContextsPerBrowser: number;

	/**
	 * Time in milliseconds to wait for a browser to become available.
	 * @default 30000
	 */
	acquireTimeout: number;

	/**
	 * Time in milliseconds before an idle browser can be restarted.
	 * @default 300000 (5 minutes)
	 */
	idleTimeout: number;

	/**
	 * Enable browser pooling.
	 * If false, falls back to creating browsers on-demand.
	 * @default true
	 */
	enabled: boolean;

	/**
	 * Restart browsers after this many contexts have been created.
	 * Helps prevent memory leaks in long-running browsers.
	 * @default 50
	 */
	maxContextsBeforeRestart: number;
}

/**
 * Default browser pool configuration.
 */
export const DEFAULT_BROWSER_POOL_CONFIG: BrowserPoolConfig = {
	poolSize: 2,
	maxContextsPerBrowser: 4,
	acquireTimeout: 30000,
	idleTimeout: 300000,
	enabled: true,
	maxContextsBeforeRestart: 50,
};

/**
 * Represents a browser instance in the pool with metadata.
 */
export interface PooledBrowser {
	id: string;
	browser: import('playwright').Browser;
	activeContexts: number;
	totalContextsCreated: number;
	createdAt: Date;
	lastUsedAt: Date;
	isHealthy: boolean;
	/**
	 * Marcado como true quando o browser atingiu maxContextsBeforeRestart.
	 * Browsers com esta flag não recebem novas sessões (drain pattern).
	 * O reinício ocorre somente quando activeContexts chegar a 0.
	 */
	isPendingRestart: boolean;
	/**
	 * Lock que impede múltiplas chamadas concorrentes de restartBrowser()
	 * para a mesma instância (evita a "explosão" do pool).
	 */
	isRestarting: boolean;
	/**
	 * Timestamp em que isPendingRestart foi definido como true.
	 * Usado pelo health check para detectar browsers presos.
	 */
	pendingRestartSince?: Date;
}
