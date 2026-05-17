import { createHash } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { FilesService } from '@files/application/services/files.service';
import { Cover } from '@books/infrastructure/database/entities/cover.entity';
import { CoverImageService } from './cover-image.service';

describe('CoverImageService', () => {
	let service: CoverImageService;

	const mockCoverImageQueue = {
		add: jest.fn(),
	};

	const mockCoverRepository = {
		find: jest.fn(),
		save: jest.fn(),
	};

	const mockFilesService = {
		getFileBuffer: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CoverImageService,
				{
					provide: 'BullQueue_cover-image-queue',
					useValue: mockCoverImageQueue,
				},
				{
					provide: getRepositoryToken(Cover),
					useValue: mockCoverRepository,
				},
				{
					provide: FilesService,
					useValue: mockFilesService,
				},
			],
		}).compile();

		service = module.get<CoverImageService>(CoverImageService);
	});

	it('should enqueue cover batch job', async () => {
		mockCoverImageQueue.add.mockResolvedValue(undefined);

		await service.addCoverToQueue('book-1', 'https://origin.test', [
			{ url: 'https://cdn.test/cover.jpg', title: 'Cover 1' },
		]);

		expect(mockCoverImageQueue.add).toHaveBeenCalledWith(
			'process-cover',
			{
				bookId: 'book-1',
				urlOrigin: 'https://origin.test',
				covers: [
					{ url: 'https://cdn.test/cover.jpg', title: 'Cover 1' },
				],
			},
			expect.objectContaining({
				jobId: expect.stringMatching(/^cover-image-book-1-\d+$/),
			}),
		);
	});

	it('should ignore duplicate queue error', async () => {
		mockCoverImageQueue.add.mockRejectedValue(
			new Error('Job with this id already exists'),
		);

		await expect(
			service.addCoverToQueue('book-1', 'https://origin.test', []),
		).resolves.toBeUndefined();
	});

	it('should calculate hash from local /data path', async () => {
		const buffer = Buffer.from('local-image-bytes');
		mockFilesService.getFileBuffer.mockResolvedValue(buffer);

		const hash = await service.calculateLocalImageHash(
			'/data/covers/cover.webp',
		);

		const expectedHash = createHash('sha256').update(buffer).digest('hex');
		expect(hash).toBe(expectedHash);
		expect(mockFilesService.getFileBuffer).toHaveBeenCalledWith(
			'/data/covers/cover.webp',
			StorageBucket.BOOKS,
		);
	});
});
