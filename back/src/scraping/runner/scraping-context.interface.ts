import type { BrowserContext, Page } from 'playwright';
import { WebsiteConfigDto } from '../dto/website-config.dto';
import { NetworkInterceptor } from '../helpers/network-interceptor';
import { StorageInjector } from '../helpers/storage-injector';

export interface ScrapingContext {
    page: Page;
    context: BrowserContext;
    config: WebsiteConfigDto;
    networkInterceptor?: NetworkInterceptor;
    storageInjector: StorageInjector | null;
}

export type ScrapingTask<T> = (context: ScrapingContext) => Promise<T>;
