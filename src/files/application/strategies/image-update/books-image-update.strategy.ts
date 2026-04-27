import { Inject, Injectable } from '@nestjs/common';
import { StorageBucket } from '../../../../common/enum/storage-bucket.enum';
import {
	I_PAGE_REPOSITORY,
	IPageRepository,
} from '../../../../books/application/ports/page-repository.interface';
import {
	I_COVER_REPOSITORY,
	ICoverRepository,
} from '../../../../books/application/ports/cover-repository.interface';
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
	) {}

	supports(bucket: StorageBucket): boolean {
		return bucket === StorageBucket.BOOKS;
	}

	async updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void> {
		const updates = events.map((event) => ({
			oldPath: event.rawPath,
			newPath: `${event.targetBucket}/${event.targetPath}`,
			metadata: event.metadata,
		}));

		// Atualiza Páginas e Capas em lote
		await Promise.all([
			this.pageRepository.updateBatch(updates),
			this.coverRepository.updateBatch(updates),
		]);
	}
}
