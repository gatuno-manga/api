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
