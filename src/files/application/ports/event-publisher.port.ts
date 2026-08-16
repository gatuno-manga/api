export interface ImageProcessingRequestEvent {
	rawPath: string;
	targetBucket: string;
	targetPath: string;
	isBackfill?: boolean;
	widths?: number[];
}

export interface EventPublisherPort {
	publishImageProcessingRequest(
		event: ImageProcessingRequestEvent,
	): Promise<void>;
}
