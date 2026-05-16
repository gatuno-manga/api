import { Inject, Injectable, Logger } from '@nestjs/common';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import {
	ImageProcessingCompletedEvent,
	ImageUpdateStrategy,
} from '@files/application/strategies/image-update/image-update.strategy';

export const IMAGE_UPDATE_STRATEGIES = 'IMAGE_UPDATE_STRATEGIES';

@Injectable()
export class HandleImageProcessingCompletedUseCase {
	private readonly logger = new Logger(
		HandleImageProcessingCompletedUseCase.name,
	);

	constructor(
		@Inject(IMAGE_UPDATE_STRATEGIES)
		private readonly strategies: ImageUpdateStrategy[],
	) {}

	async executeBatch(events: ImageProcessingCompletedEvent[]): Promise<void> {
		// Agrupa eventos por bucket para processamento em lote
		const groupedEvents = events.reduce(
			(acc, event) => {
				const bucket = event.targetBucket as StorageBucket;
				if (!acc[bucket]) acc[bucket] = [];
				acc[bucket].push(event);
				return acc;
			},
			{} as Record<StorageBucket, ImageProcessingCompletedEvent[]>,
		);

		const batchPromises = Object.entries(groupedEvents).map(
			([bucket, bucketEvents]) => {
				const strategy = this.strategies.find((s) =>
					s.supports(bucket as StorageBucket),
				);

				if (!strategy) {
					this.logger.warn(
						`Nenhuma estratégia encontrada para o bucket: ${bucket}`,
					);
					return Promise.resolve();
				}

				return strategy.updateBatch(bucketEvents);
			},
		);

		await Promise.all(batchPromises);
	}
}
