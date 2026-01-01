import { Injectable, Logger } from '@nestjs/common';
import { IFileCompressor } from '../interfaces/file-compressor.interface';

@Injectable()
export class NoCompressionAdapter implements IFileCompressor {
	private readonly logger = new Logger(NoCompressionAdapter.name);

	async compress(buffer: Buffer): Promise<Buffer> {
		this.logger.debug('Arquivo sem compressão, retornando original');
		return buffer;
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
