export interface ImageProcessingRequestEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
}

export interface EventPublisherPort {
	publishImageProcessingRequest(
		event: ImageProcessingRequestEvent,
	): Promise<void>;
}
