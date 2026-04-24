export class Image {
	constructor(
		public readonly path: string,
		public readonly width: number | null = null,
		public readonly height: number | null = null,
	) {}

	static create(path: string, width?: number, height?: number): Image {
		return new Image(path, width ?? null, height ?? null);
	}
}
