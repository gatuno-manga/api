import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';
import { Chapter } from './chapter';

export class Page {
	id: number;
	index: number;
	chapter: Chapter;
	path: string;
	metadata: ImageMetadata | null;
	deletedAt: Date | null;
}
