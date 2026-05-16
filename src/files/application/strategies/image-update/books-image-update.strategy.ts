import { Inject, Injectable } from '@nestjs/common';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { RedisService } from '@/infrastructure/redis/redis.service';
import {
	I_PAGE_REPOSITORY,
	IPageRepository,
} from '@books/application/ports/page-repository.interface';
import {
	I_COVER_REPOSITORY,
	ICoverRepository,
} from '@books/application/ports/cover-repository.interface';
import {
	ImageProcessingCompletedEvent,
	ImageUpdateStrategy,
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

	async updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void> {
		const updates = events
			.filter((event) => event.results && event.results.length > 0)
			.map((event) => ({
				oldPath: event.rawPath,
				newPath: event.results[0].targetPath,
				metadata: event.results[0].metadata,
			}));

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
				}),
				'EX',
				3600,
			);
		});

		await Promise.all(cachePromises);
	}
}
