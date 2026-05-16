import { ImageMetadata } from 'src/common/domain/value-objects/image-metadata.vo';

export type ScrapedImageDataDto = {
	path: string;
	metadata: ImageMetadata;
};
