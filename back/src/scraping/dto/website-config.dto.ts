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
    chapterExtractScript?: string;
}
