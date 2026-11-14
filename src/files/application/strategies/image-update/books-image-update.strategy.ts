import { RedisService } from '@/infrastructure/redis/redis.service';
import {
	ICoverRepository,
	I_COVER_REPOSITORY,
} from '@books/application/ports/cover-repository.interface';
import {
	IPageRepository,
	I_PAGE_REPOSITORY,
} from '@books/application/ports/page-repository.interface';
import { ImageVariant } from '@common/domain/value-objects/image-variant.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Inject, Injectable } from '@nestjs/common';
import {
	ImageProcessingCompletedEvent,
	ImageUpdateStrategy,
	stripTargetBucketPrefix,
} from './image-update.strategy';

@Injectable()
export class BooksImageUpdateStrategy implements ImageUpdateStrategy {
	constructor(
		@Inject(I_PAGE_REPOSITORY)
		private readonly pageRepository: IPageRepository,
		@Inject(I_COVER_REPOSITORY)
		private readonly coverRepository: ICoverRepository,
		private readonly redisService: RedisService,
	) {}

	supports(bucket: StorageBucket): boolean {
		return bucket === StorageBucket.BOOKS;
	}

	/**
	 * Deriva o path usado como chave de busca no banco (cover.url / page.path).
	 * Reprocessamento in-place (isBackfill) já chega com o prefixo do bucket
	 * final; o fluxo normal envia o rawPath no bucket "processing".
	 */
	private resolveOldPath(rawPath: string, targetBucket: string): string {
		const storedPath = stripTargetBucketPrefix(rawPath, targetBucket);
		if (storedPath !== rawPath) {
			return storedPath;
		}

		let oldPath = rawPath.replace(/^(books|processing)\//, '');
		if (!oldPath.startsWith('processing/')) {
			oldPath = `processing/${oldPath}`;
		}
		return oldPath;
	}

	async updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void> {
		const updates = events
			.filter((event) => event.results && event.results.length > 0)
			.map((event) => {
				const original =
					event.results.find((r) => r.kind !== 'variant') ??
					event.results[0];
				const variants: ImageVariant[] = event.results
					.filter((r) => r.kind === 'variant')
					.map((r) => ({
						width: r.metadata.width,
						path: r.targetPath,
						metadata: r.metadata,
					}));

				return {
					oldPath: this.resolveOldPath(
						event.rawPath,
						event.targetBucket,
					),
					newPath: original.targetPath,
					metadata: original.metadata,
					originalUrl: event.originalUrl,
					variants: variants.length > 0 ? variants : undefined,
				};
			});

		if (updates.length === 0) return;

		await Promise.all([
			this.pageRepository.updateBatch(updates),
			this.coverRepository.updateBatch(updates),
		]);

		const redis = this.redisService.getClient();
		const cachePromises = updates.map((update) => {
			const cacheKey = `pending_optimization:${update.oldPath}`;
			return redis.set(
				cacheKey,
				JSON.stringify({
					path: update.newPath,
					metadata: update.metadata,
					variants: update.variants,
				}),
				'EX',
				3600,
			);
		});

		await Promise.all(cachePromises);
	}
}
