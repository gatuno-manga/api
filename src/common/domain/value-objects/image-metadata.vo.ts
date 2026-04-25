export type ImageMetadata = {
	width: number;
	height: number;
	sizeBytes?: number;
	mimeType?: string;
	blurHash?: string;
	dominantColor?: string;
	pHash?: string;
	entropy?: number;
	formatOrigin?: string;
};
