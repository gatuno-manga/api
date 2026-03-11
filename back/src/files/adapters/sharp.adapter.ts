import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { IFileCompressor } from '../interfaces/file-compressor.interface';
import { IImageCompressor } from '../interfaces/image-compressor.interface';

// Disable libvips operation cache so it doesn't accumulate decoded images
// across processing sessions. Without this, libvips quietly grows outside
// the V8 heap and V8's GC never sees the pressure.
sharp.cache(false);

@Injectable()
export class SharpAdapter implements IImageCompressor, IFileCompressor {
	private readonly supportedExtensions = [
		'.jpg',
		'.jpeg',
		'.png',
		'.webp',
		'.bmp',
		'.tiff',
		'.gif',
		'.avif',
		'.heif',
	];

	async compress(buffer: Buffer): Promise<Buffer> {
		const sharpInstance = sharp(buffer);
		const pipeline = sharpInstance.webp({
			lossless: false,
			quality: 80,
		});
		return await pipeline.toBuffer();
	}

	supports(extension: string): boolean {
		return this.supportedExtensions.includes(extension.toLowerCase());
	}

	getOutputExtension(originalExtension: string): string {
		return '.webp';
	}

	getSupportedExtensions(): string[] {
		return [...this.supportedExtensions];
	}
}
