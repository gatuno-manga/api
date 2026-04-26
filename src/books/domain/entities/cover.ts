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
	book: Book;
	deletedAt: Date | null;
}
