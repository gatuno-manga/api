import { RedisService } from '@/infrastructure/redis/redis.service';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { I_PAGE_REPOSITORY } from '@books/application/ports/page-repository.interface';
import { ImageMetadata } from '@common/domain/value-objects/image-metadata.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { Test, TestingModule } from '@nestjs/testing';
import { BooksImageUpdateStrategy } from './books-image-update.strategy';
import { ImageProcessingCompletedEvent } from './image-update.strategy';

describe('BooksImageUpdateStrategy', () => {
	let strategy: BooksImageUpdateStrategy;
	let pageRepositoryMock: any;
	let coverRepositoryMock: any;
	let redisServiceMock: any;
	let redisClientMock: any;

	beforeEach(async () => {
		pageRepositoryMock = {
			updateBatch: jest.fn().mockResolvedValue(undefined),
		};

		coverRepositoryMock = {
			updateBatch: jest.fn().mockResolvedValue(undefined),
		};

		redisClientMock = {
			set: jest.fn().mockResolvedValue(undefined),
		};

		redisServiceMock = {
			getClient: jest.fn().mockReturnValue(redisClientMock),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BooksImageUpdateStrategy,
				{
					provide: I_PAGE_REPOSITORY,
					useValue: pageRepositoryMock,
				},
				{
					provide: I_COVER_REPOSITORY,
					useValue: coverRepositoryMock,
				},
				{
					provide: RedisService,
					useValue: redisServiceMock,
				},
			],
		}).compile();

		strategy = module.get<BooksImageUpdateStrategy>(
			BooksImageUpdateStrategy,
		);
	});

	it('should correctly format updates and include originalUrl to prevent swapping', async () => {
		const mockMetadata = {
			width: 100,
			height: 200,
		} as ImageMetadata;

		const events: ImageProcessingCompletedEvent[] = [
			{
				rawPath: 'processing/uuid-1.webp',
				originalUrl: 'https://source/cover1.jpg',
				targetBucket: StorageBucket.BOOKS,
				results: [
					{
						targetPath: 'books/optimized-uuid-1.webp',
						metadata: mockMetadata,
					},
				],
			},
		];

		await strategy.updateBatch(events);

		const expectedUpdates = [
			{
				oldPath: 'processing/uuid-1.webp',
				newPath: 'books/optimized-uuid-1.webp',
				metadata: mockMetadata,
				originalUrl: 'https://source/cover1.jpg',
				variants: undefined,
			},
		];

		expect(pageRepositoryMock.updateBatch).toHaveBeenCalledWith(
			expectedUpdates,
		);
		expect(coverRepositoryMock.updateBatch).toHaveBeenCalledWith(
			expectedUpdates,
		);

		expect(redisClientMock.set).toHaveBeenCalledWith(
			'pending_optimization:processing/uuid-1.webp',
			JSON.stringify({
				path: 'books/optimized-uuid-1.webp',
				metadata: mockMetadata,
				variants: undefined,
			}),
			'EX',
			3600,
		);
	});

	it('should treat rawPath already in the target bucket as an in-place reprocess (backfill), matching the path already stored in the DB', async () => {
		const mockMetadata = { width: 1920, height: 2841 } as ImageMetadata;

		const events: ImageProcessingCompletedEvent[] = [
			{
				rawPath: 'books/ab/uuid.webp',
				targetBucket: StorageBucket.BOOKS,
				results: [
					{
						targetPath: 'ab/uuid.webp',
						metadata: mockMetadata,
						kind: 'original',
					},
				],
			},
		];

		await strategy.updateBatch(events);

		const expectedUpdates = [
			{
				oldPath: 'ab/uuid.webp',
				newPath: 'ab/uuid.webp',
				metadata: mockMetadata,
				originalUrl: undefined,
				variants: undefined,
			},
		];

		expect(coverRepositoryMock.updateBatch).toHaveBeenCalledWith(
			expectedUpdates,
		);
	});

	it('should split variant results from the original and pass them separately to the cover repository', async () => {
		const originalMetadata = { width: 1920, height: 2841 } as ImageMetadata;
		const variant600Metadata = { width: 600, height: 888 } as ImageMetadata;
		const variant300Metadata = { width: 300, height: 444 } as ImageMetadata;

		const events: ImageProcessingCompletedEvent[] = [
			{
				rawPath: 'processing/ab/uuid.jpg',
				targetBucket: StorageBucket.BOOKS,
				results: [
					{
						targetPath: 'ab/uuid.webp',
						metadata: originalMetadata,
						kind: 'original',
					},
					{
						targetPath: 'ab/uuid_w600.webp',
						metadata: variant600Metadata,
						kind: 'variant',
					},
					{
						targetPath: 'ab/uuid_w300.webp',
						metadata: variant300Metadata,
						kind: 'variant',
					},
				],
			},
		];

		await strategy.updateBatch(events);

		const expectedUpdates = [
			{
				oldPath: 'processing/ab/uuid.jpg',
				newPath: 'ab/uuid.webp',
				metadata: originalMetadata,
				originalUrl: undefined,
				variants: [
					{
						width: 600,
						path: 'ab/uuid_w600.webp',
						metadata: variant600Metadata,
					},
					{
						width: 300,
						path: 'ab/uuid_w300.webp',
						metadata: variant300Metadata,
					},
				],
			},
		];

		expect(coverRepositoryMock.updateBatch).toHaveBeenCalledWith(
			expectedUpdates,
		);
	});
});
