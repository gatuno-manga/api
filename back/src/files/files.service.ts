import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { AppConfigService } from 'src/app-config/app-config.service';
import * as sharp from 'sharp';
import e from 'express';

@Injectable()
export class FilesService {
	private downloadDir = path.resolve('/usr/src/app/data');
	private readonly logger = new Logger(FilesService.name);
	private imageExtensions = [
		'.jpg',
		'.jpeg',
		'.png',
		'.webp',
		'.bmp',
		'.tiff',
		'.gif',
	];

	private getPublicPath(fileName: string): string {
		return `/data/${fileName}`;
	}

	async compressImage(
		base64Data: string,
		extension: string,
	): Promise<Buffer> {
		const sharpInstance = sharp(Buffer.from(base64Data, 'base64'));
		const pipeline = sharpInstance.webp({
			lossless: false,
		});
		return pipeline.toBuffer();
	}

	async saveBase64File(
		base64Data: string,
		extension: string,
	): Promise<string> {
		let fileBuffer: Buffer;
		if (this.imageExtensions.includes(extension.toLowerCase())) {
			fileBuffer = await this.compressImage(base64Data, extension);
			extension = '.webp';
		} else {
			fileBuffer = Buffer.from(base64Data, 'base64');
		}
		const fileName = `${uuidv4()}${extension}`;
		const filePath = path.join(this.downloadDir, fileName);
		await fs.writeFile(filePath, fileBuffer);

		this.logger.log(`Arquivo salva em: ${filePath}`);
		return this.getPublicPath(fileName);
	}
}
