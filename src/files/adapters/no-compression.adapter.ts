import { Injectable, Logger } from '@nestjs/common';
import { IFileCompressor } from '../interfaces/file-compressor.interface';

@Injectable()
export class NoCompressionAdapter implements IFileCompressor {
	private readonly logger = new Logger(NoCompressionAdapter.name);

	compress(buffer: Buffer): Promise<Buffer> {
		this.logger.debug('Arquivo sem compressão, retornando original');
		return Promise.resolve(buffer);
	}

	supports(extension: string): boolean {
		return true;
	}

	getOutputExtension(originalExtension: string): string {
		return originalExtension;
	}

	getSupportedExtensions(): string[] {
		return ['*'];
	}
}
