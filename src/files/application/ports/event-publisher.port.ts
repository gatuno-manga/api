export interface ImageProcessingRequestEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
	isBackfill?: boolean;
}

export interface EventPublisherPort {
	publishImageProcessingRequest(
		event: ImageProcessingRequestEvent,
	): Promise<void>;
}
