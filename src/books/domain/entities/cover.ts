import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import { ImageVariant } from 'src/common/domain/value-objects/image-variant.vo';
import { Book } from './book';

export class Cover {
	id: string;
	url: string;
	title: string;
	index: number;
	metadata: ImageMetadata | null;
	variants: ImageVariant[] | null;
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
