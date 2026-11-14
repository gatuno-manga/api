import { ImageMetadata } from '@common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';

export interface ImageProcessingResult {
	targetPath: string;
	metadata: ImageMetadata;
	kind?: 'original' | 'variant' | 'part';
}

export interface ImageProcessingCompletedEvent {
	rawPath: string;
	originalUrl?: string;
	targetBucket: string;
	results: ImageProcessingResult[];
}

/**
 * Reprocessamento in-place (isBackfill) envia o rawPath já no bucket final
 * (ex: "books/ab/uuid.webp"), enquanto o banco guarda o path sem o prefixo do
 * bucket. Devolve o path como está salvo; sem o prefixo, devolve o rawPath
 * inalterado.
 */
export function stripTargetBucketPrefix(
	rawPath: string,
	targetBucket: string,
): string {
	const bucketPrefix = `${targetBucket}/`;
	return rawPath.startsWith(bucketPrefix)
		? rawPath.substring(bucketPrefix.length)
		: rawPath;
}

export interface ImageUpdateStrategy {
	supports(bucket: StorageBucket): boolean;
	updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void>;
}
