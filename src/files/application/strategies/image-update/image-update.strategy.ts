import { StorageBucket } from '../../../../common/enum/storage-bucket.enum';
import { ImageMetadata } from '../../../../common/domain/value-objects/image-metadata.vo';

export interface ImageProcessingCompletedEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
	metadata?: ImageMetadata;
}

export interface ImageUpdateStrategy {
	supports(bucket: StorageBucket): boolean;
	updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void>;
}
