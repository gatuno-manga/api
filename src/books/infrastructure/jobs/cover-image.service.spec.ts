import { createHash } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScrapingService } from '@scraping/application/services/scraping.service';
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

	const mockScrapingService = {
		fetchImageBuffer: jest.fn(),
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
					provide: ScrapingService,
					useValue: mockScrapingService,
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

	it('should calculate hash from remote image buffer', async () => {
		const buffer = Buffer.from('remote-image-bytes');
		mockScrapingService.fetchImageBuffer.mockResolvedValue(buffer);

		const hash = await service.calculateImageHash(
			'https://cdn.test/cover.jpg',
			'https://book-origin.test',
		);

		const expectedHash = createHash('sha256').update(buffer).digest('hex');
		expect(hash).toBe(expectedHash);
		expect(mockScrapingService.fetchImageBuffer).toHaveBeenCalledWith(
			'https://book-origin.test',
			'https://cdn.test/cover.jpg',
		);
	});

	it('should calculate hash from local /data path', async () => {
		const buffer = Buffer.from('local-image-bytes');
		mockFilesService.getFileBuffer.mockResolvedValue(buffer);

		const hash = await service.calculateImageHash(
			'/data/covers/cover.webp',
		);

		const expectedHash = createHash('sha256').update(buffer).digest('hex');
		expect(hash).toBe(expectedHash);
		expect(mockFilesService.getFileBuffer).toHaveBeenCalledWith(
			'/data/covers/cover.webp',
			StorageBucket.BOOKS,
		);
	});

	it('should recalculate and persist hashes for covers without hash', async () => {
		mockCoverRepository.find.mockResolvedValue([
			{
				id: 'cover-1',
				url: '/data/covers/cover-1.webp',
				book: { originalUrl: ['https://origin.test/book'] },
				imageHash: null,
			},
		]);
		mockCoverRepository.save.mockResolvedValue(undefined);
		const calculateHashSpy = jest
			.spyOn(service, 'calculateImageHash')
			.mockResolvedValue('hash-1');

		await service.recalculateMissingCoverHashes();

		expect(calculateHashSpy).toHaveBeenCalledWith(
			'/data/covers/cover-1.webp',
			'https://origin.test/book',
		);
		expect(mockCoverRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'cover-1',
				imageHash: 'hash-1',
			}),
		);
	});
});
