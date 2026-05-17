import { StoragePort } from '@files/application/ports/storage.port';
import {
	Controller,
	Get,
	Logger,
	NotFoundException,
	Param,
	Res,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

@Controller('data')
export class FilesController {
	private readonly logger = new Logger(FilesController.name);

	constructor(
		@Inject('STORAGE_PORT') private readonly storagePort: StoragePort,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Rota para os novos Buckets Reais (ex: /data/books/ab/uuid.webp)
	 */
	@Get(':bucket/:shard/:filename')
	@Throttle({ short: { limit: 100, ttl: 1000 } })
	getFileWithBucket(
		@Param('bucket') bucket: string,
		@Param('shard') shard: string,
		@Param('filename') filename: string,
		@Res() res: Response,
	) {
		return this.redirectToFile(bucket, shard, filename, res);
	}

	/**
	 * Rota legado para arquivos no bucket padrão (ex: /data/ab/uuid.webp)
	 */
	@Get(':shard/:filename')
	@Throttle({ short: { limit: 100, ttl: 1000 } })
	getFileLegacy(
		@Param('shard') shard: string,
		@Param('filename') filename: string,
		@Res() res: Response,
	) {
		const defaultBucket =
			this.configService.get<string>('RUSTFS_BUCKET') || 'gatuno-files';
		return this.redirectToFile(defaultBucket, shard, filename, res);
	}

	private redirectToFile(
		bucket: string,
		shard: string,
		filename: string,
		res: Response,
	) {
		const fileKey = `${shard}/${filename}`;

		try {
			// Usamos o RUSTFS_PUBLIC_URL para o redirecionamento externo
			// Se não houver, tentamos o ENDPOINT (mas ENDPOINT costuma ser interno da rede Docker)
			const publicEndpoint =
				this.configService.get<string>('RUSTFS_PUBLIC_URL') ||
				'http://localhost:9000';

			// Redireciona para o RustFS usando o bucket correto
			return res.redirect(`${publicEndpoint}/${bucket}/${fileKey}`);
		} catch (error) {
			this.logger.error(
				`Error serving file ${bucket}/${fileKey}:`,
				error,
			);
			throw new NotFoundException('File not found');
		}
	}
}
