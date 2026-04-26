import { Chapter } from './chapter';
import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

export class Page {
	id: number;
	index: number;
	chapter: Chapter;
	path: string;
	metadata: ImageMetadata | null;
	deletedAt: Date | null;
}
