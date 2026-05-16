import { BrowserContext, Page } from 'playwright';
import { WebsiteConfigDto } from '@scraping/application/dto/website-config.dto';
import { NetworkInterceptor } from '@scraping/infrastructure/helpers/network-interceptor';
import { StorageInjector } from '@scraping/infrastructure/helpers/storage-injector';

export interface ScrapingContext {
	page: Page;
	context: BrowserContext;
	config: WebsiteConfigDto;
	networkInterceptor?: NetworkInterceptor;
	storageInjector: StorageInjector | null;
}

export type ScrapingTask<T> = (context: ScrapingContext) => Promise<T>;
