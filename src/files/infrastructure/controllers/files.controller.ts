import {
	Controller,
	Get,
	Param,
	Res,
	NotFoundException,
	Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { StoragePort } from '../../application/ports/storage.port';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('data')
@SkipThrottle()
export class FilesController {
	private readonly logger = new Logger(FilesController.name);

	constructor(
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
		private readonly configService: ConfigService,
	) {}

	@Get(':shard/:filename')
	async getFile(
		@Param('shard') shard: string,
		@Param('filename') filename: string,
		@Res() res: Response,
	) {
		const fileKey = `${shard}/${filename}`;

		try {
			const publicEndpoint =
				this.configService.get<string>('RUSTFS_PUBLIC_ENDPOINT') ||
				'http://localhost:9000';
			const bucket =
				this.configService.get<string>('RUSTFS_BUCKET') ||
				'gatuno-files';

			// Redireciona para o RustFS
			return res.redirect(`${publicEndpoint}/${bucket}/${fileKey}`);
		} catch (error) {
			this.logger.error(`Error serving file ${fileKey}:`, error);
			throw new NotFoundException('File not found');
		}
	}
}
