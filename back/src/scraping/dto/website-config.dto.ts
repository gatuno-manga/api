export class WebsiteConfigDto {
    selector: string;
    preScript: string;
    posScript: string;
    ignoreFiles: string[];
    concurrencyLimit?: number | null;
    blacklistTerms: string[];
    whitelistTerms: string[];
    useNetworkInterception: boolean;
    useScreenshotMode: boolean;
}
