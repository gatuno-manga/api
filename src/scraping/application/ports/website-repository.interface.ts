import { Website } from '../../domain/entities/website';

export interface IWebsiteRepository {
	findById(id: string): Promise<Website | null>;
	findByUrl(url: string): Promise<Website | null>;
	findAll(): Promise<Website[]>;
	save(website: Website): Promise<Website>;
	delete(id: string): Promise<void>;
}

export const I_WEBSITE_REPOSITORY = 'IWebsiteRepository';
