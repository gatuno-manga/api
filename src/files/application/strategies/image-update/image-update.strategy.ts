import { ImageMetadata } from '@common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';

export interface ImageProcessingResult {
	targetPath: string;
	metadata: ImageMetadata;
}

export interface ImageProcessingCompletedEvent {
	rawPath: string;
	originalUrl?: string;
	targetBucket: string;
	results: ImageProcessingResult[];
}

export interface ImageUpdateStrategy {
	supports(bucket: StorageBucket): boolean;
	updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void>;
}
