import { ImageMetadata } from './image-metadata.vo';

export type ImageVariant = {
	width: number;
	path: string;
	metadata?: ImageMetadata;
};
