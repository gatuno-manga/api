import { Inject, Injectable } from '@nestjs/common';
import { StorageBucket } from '../../../../common/enum/storage-bucket.enum';
import {
	I_USER_IMAGE_REPOSITORY,
	IUserImageRepository,
} from '../../../../users/application/ports/user-image-repository.interface';
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
		const updates = events.map((event) => ({
			oldPath: event.rawPath,
			newPath: `${event.targetBucket}/${event.targetPath}`,
			metadata: event.metadata,
		}));

		await this.userImageRepository.updateBatch(updates);
	}
}
