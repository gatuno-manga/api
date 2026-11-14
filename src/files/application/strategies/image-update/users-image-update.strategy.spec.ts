import { ImageMetadata } from '@common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Test, TestingModule } from '@nestjs/testing';
import { I_USER_IMAGE_REPOSITORY } from '@users/application/ports/user-image-repository.interface';
import { ImageProcessingCompletedEvent } from './image-update.strategy';
import { UsersImageUpdateStrategy } from './users-image-update.strategy';

describe('UsersImageUpdateStrategy', () => {
	let strategy: UsersImageUpdateStrategy;
	let userImageRepositoryMock: { updateBatch: jest.Mock };

	const metadata = { width: 100, height: 100 } as ImageMetadata;

	const completedEvent = (
		rawPath: string,
	): ImageProcessingCompletedEvent => ({
		rawPath,
		targetBucket: StorageBucket.USERS,
		results: [{ targetPath: 'ab/uuid.webp', metadata }],
	});

	beforeEach(async () => {
		userImageRepositoryMock = {
			updateBatch: jest.fn().mockResolvedValue(undefined),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersImageUpdateStrategy,
				{
					provide: I_USER_IMAGE_REPOSITORY,
					useValue: userImageRepositoryMock,
				},
			],
		}).compile();

		strategy = module.get(UsersImageUpdateStrategy);
	});

	it('looks up a backfilled image by its stored path, without the bucket prefix', async () => {
		await strategy.updateBatch([completedEvent('users/ab/uuid.webp')]);

		expect(userImageRepositoryMock.updateBatch).toHaveBeenCalledWith([
			{ oldPath: 'ab/uuid.webp', newPath: 'ab/uuid.webp', metadata },
		]);
	});

	it('looks up a freshly uploaded image by its processing path, unchanged', async () => {
		await strategy.updateBatch([completedEvent('processing/ab/uuid.jpg')]);

		expect(userImageRepositoryMock.updateBatch).toHaveBeenCalledWith([
			{
				oldPath: 'processing/ab/uuid.jpg',
				newPath: 'ab/uuid.webp',
				metadata,
			},
		]);
	});
});
