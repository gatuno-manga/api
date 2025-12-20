import { CookieConfig } from '../helpers/storage-injector';

export class WebsiteConfigDto {
    selector: string;
    preScript: string;
    posScript: string;
    concurrencyLimit?: number | null;
    blacklistTerms: string[];
    whitelistTerms: string[];
    useNetworkInterception: boolean;
    useScreenshotMode: boolean;
    chapterListSelector?: string;
    bookInfoExtractScript?: string;
    /** Cookies to inject before navigation */
    cookies?: CookieConfig[];
    /** localStorage items to inject after page load */
    localStorage?: Record<string, string>;
    /** sessionStorage items to inject after page load */
    sessionStorage?: Record<string, string>;
    /** Whether to reload the page after injecting storage */
    reloadAfterStorageInjection?: boolean;
}
