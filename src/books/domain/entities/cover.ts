import { ScrapingStatus } from '../enums/scrapingStatus.enum';
import { Book } from './book';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

export class Cover {
	id: string;
	url: string;
	title: string;
	index: number;
	metadata: ImageMetadata | null;
	imageHash: string | null;
	originalUrl: string | null;
	selected: boolean;
	scrapingStatus: ScrapingStatus | null;
	retries: number;
	book: Book;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}
