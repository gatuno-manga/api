export class WebsiteConfigDto {
    selector: string;
    preScript: string;
    posScript: string;
    ignoreFiles: string[];
    concurrencyLimit?: number | null;
}
