export class Website {
	id: string;
	url: string;
	preScript: string | null;
	posScript: string | null;
	selector: string;
	chapterListSelector: string | null;
	bookInfoExtractScript: string | null;
	concurrencyLimit: number | null;
	blacklistTerms: string[] | null;
	whitelistTerms: string[] | null;
	useNetworkInterception: boolean;
	useScreenshotMode: boolean;
	cookies: Array<{
		name: string;
		value: string;
		domain?: string;
		path?: string;
		secure?: boolean;
		httpOnly?: boolean;
		sameSite?: 'Strict' | 'Lax' | 'None';
		expires?: number;
	}> | null;
	localStorage: Record<string, string> | null;
	sessionStorage: Record<string, string> | null;
	reloadAfterStorageInjection: boolean;
	enableAdaptiveTimeouts: boolean;
	timeoutMultipliers: Record<string, number> | null;
	createdAt: Date;
	updatedAt: Date;
}
