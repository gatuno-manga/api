import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../infrastructure/app-config/app-config.service';
import { StorageBucket } from '../enum/storage-bucket.enum';

@Injectable()
export class MediaUrlService {
	constructor(private readonly appConfig: AppConfigService) {}

	/**
	 * Resolves a media path to an absolute URL using Real Multi-Buckets.
	 *
	 * @param path The relative path or key (e.g., '0a/uuid.webp')
	 * @param bucket The real S3 bucket name (StorageBucket enum)
	 * @returns The absolute URL (e.g., 'http://api.gatuno.local/api/data/books/0a/uuid.webp')
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

		// Clean the path to remove leading slashes and legacy prefixes
		const cleanPath = path
			.replace(/^\/?(api\/)?data\//, '')
			.replace(/^\//, '');

		// If the path already includes the bucket name at the start, remove it
		// (The DB might still have them from the previous attempt)
		const bucketName = bucket.toString();
		let finalInternalPath = cleanPath;
		if (cleanPath.startsWith(`${bucketName}/`)) {
			finalInternalPath = cleanPath.substring(bucketName.length + 1);
		}

		// Since we are using Multi-Buckets in RustFS, the URL structure is:
		// BASE_URL / BUCKET_NAME / PATH
		const baseUrl = this.appConfig.rustfsPublicUrl;

		return `${baseUrl}/${bucketName}/${finalInternalPath}`;
	}
}
