import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Inject, Injectable } from '@nestjs/common';
import {
	IUserImageRepository,
	I_USER_IMAGE_REPOSITORY,
} from '@users/application/ports/user-image-repository.interface';
import {
	ImageProcessingCompletedEvent,
	ImageUpdateStrategy,
} from './image-update.strategy';

@Injectable()
export class UsersImageUpdateStrategy implements ImageUpdateStrategy {
	constructor(
		@Inject(I_USER_IMAGE_REPOSITORY)
		private readonly userImageRepository: IUserImageRepository,
	) {}

	supports(bucket: StorageBucket): boolean {
		return bucket === StorageBucket.USERS;
	}

	async updateBatch(events: ImageProcessingCompletedEvent[]): Promise<void> {
		const updates = events
			.filter((event) => event.results && event.results.length > 0)
			.map((event) => {
				const oldPath = event.rawPath;

				return {
					oldPath,
					newPath: event.results[0].targetPath,
					metadata: event.results[0].metadata,
				};
			});

		await this.userImageRepository.updateBatch(updates);
	}
}
