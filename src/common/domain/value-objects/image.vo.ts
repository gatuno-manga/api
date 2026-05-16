import { ImageMetadata } from './image-metadata.vo';

export class Image {
	constructor(
		public readonly path: string,
		public readonly metadata: ImageMetadata | null = null,
	) {}

	static create(path: string, metadata?: ImageMetadata): Image {
		return new Image(path, metadata ?? null);
	}
}
