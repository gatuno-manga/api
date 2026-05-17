import { IFileCompressor } from '@files/application/ports/file-compressor.interface';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NoCompressionAdapter implements IFileCompressor {
	private readonly logger = new Logger(NoCompressionAdapter.name);

	compress(buffer: Buffer): Promise<Buffer> {
		this.logger.debug('Arquivo sem compressão, retornando original');
		return Promise.resolve(buffer);
	}

	supports(_extension: string): boolean {
		return true;
	}

	getOutputExtension(originalExtension: string): string {
		return originalExtension;
	}

	getSupportedExtensions(): string[] {
		return ['*'];
	}
}
