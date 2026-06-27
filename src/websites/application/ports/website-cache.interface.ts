import { Website } from '@websites/domain/entities/website';

export const I_WEBSITE_CACHE = 'I_WEBSITE_CACHE';

export interface IWebsiteCache {
	set(website: Website): Promise<void>;
	delete(id: string): Promise<void>;
}
