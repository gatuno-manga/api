import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { FileCompressorFactory } from './factories/file-compressor.factory';

@Injectable()
export class FilesService {
	private downloadDir = path.resolve('/usr/src/app/data');
	private readonly logger = new Logger(FilesService.name);

	constructor(
		private readonly compressorFactory: FileCompressorFactory,
	) {}

	private getPublicPath(fileName: string): string {
		return `/data/${fileName}`;
	}

	async compressFile(
		base64Data: string,
		extension: string,
	): Promise<{ buffer: Buffer; extension: string }> {
		const buffer = Buffer.from(base64Data, 'base64');
		return await this.compressorFactory.compress(buffer, extension);
	}

	async saveBase64File(
		base64Data: string,
		extension: string,
	): Promise<string> {
		let fileBuffer: Buffer;
		let finalExtension = extension;

		if (this.compressorFactory.hasCompressor(extension)) {
			try {
				const result = await this.compressFile(base64Data, extension);
				fileBuffer = result.buffer;
				finalExtension = result.extension;
				this.logger.log(
					`Arquivo comprimido: ${extension} -> ${finalExtension}`,
				);
			} catch (error) {
				this.logger.error(
					'Erro ao comprimir arquivo, salvando original:',
					error,
				);
				fileBuffer = Buffer.from(base64Data, 'base64');
			}
		} else {
			this.logger.debug(
				`Nenhum compressor disponível para ${extension}, salvando original`,
			);
			fileBuffer = Buffer.from(base64Data, 'base64');
		}

		const fileName = `${uuidv4()}${finalExtension}`;
		const filePath = path.join(this.downloadDir, fileName);
		await fs.writeFile(filePath, fileBuffer);

		return this.getPublicPath(fileName);
	}
}
