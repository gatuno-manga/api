import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@app-config/app-config.service';
import { StorageBucket } from '@common/enum/storage-bucket.enum';

@Injectable()
export class MediaUrlService {
	constructor(private readonly appConfig: AppConfigService) {}

	/**
	 * Resolves a media path to an absolute URL using Real Multi-Buckets.
	 *
	 * @param path The relative path or key (e.g., '0a/uuid.webp' or 'processing/0a/uuid.jpg')
	 * @param bucket The target S3 bucket name (e.g., BOOKS, USERS)
	 * @returns The absolute URL pointing to the correct bucket (temporary or final)
	 */
	resolveUrl(path: string | null, bucket: StorageBucket): string {
		if (
			!path ||
			path.startsWith('null') ||
			path.startsWith('undefined') ||
			path.startsWith('http')
		) {
			return path || '';
		}

		// 1. Limpa o path para pegar apenas o que importa
		const cleanPath = path
			.replace(/^\/?(api\/)?data\//, '')
			.replace(/^\//, '');

		// 2. DETECÇÃO DE STAGING (IMPORTANTE):
		// Se o path salvo no banco começa com "processing/", significa que a imagem
		// ainda está no bucket temporário, ignorando o bucket alvo passado por parâmetro.
		if (cleanPath.startsWith('processing/')) {
			const internalPath = cleanPath.substring('processing/'.length);
			return `${this.appConfig.rustfsPublicUrl}/processing/${internalPath}`;
		}

		// 3. Caso padrão: imagem já processada e no bucket final
		const bucketName = bucket.toString();
		let finalInternalPath = cleanPath;
		if (cleanPath.startsWith(`${bucketName}/`)) {
			finalInternalPath = cleanPath.substring(bucketName.length + 1);
		}

		return `${this.appConfig.rustfsPublicUrl}/${bucketName}/${finalInternalPath}`;
	}
}
