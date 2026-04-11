import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Chapter } from '../entities/chapter.entity';
import { ChapterScrapingService } from './chapter-scraping.service';

describe('ChapterScrapingService', () => {
	let service: ChapterScrapingService;

	const mockChapterScrapingQueue = {
		getJob: jest.fn(),
		add: jest.fn(),
	};

	const mockChapterRepository = {
		find: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChapterScrapingService,
				{
					provide: 'BullQueue_chapter-scraping',
					useValue: mockChapterScrapingQueue,
				},
				{
					provide: getRepositoryToken(Chapter),
					useValue: mockChapterRepository,
				},
			],
		}).compile();

		service = module.get<ChapterScrapingService>(ChapterScrapingService);
	});

	it('should enqueue chapter job when no previous job exists', async () => {
		mockChapterScrapingQueue.getJob.mockResolvedValue(null);
		mockChapterScrapingQueue.add.mockResolvedValue(undefined);

		await service.addChapterToQueue('chapter-1');

		expect(mockChapterScrapingQueue.add).toHaveBeenCalledWith(
			'process-chapter',
			'chapter-1',
			{ jobId: 'chapter-scraping-chapter-1' },
		);
	});

	it('should remove finished job and re-enqueue chapter', async () => {
		const existingJob = {
			getState: jest.fn().mockResolvedValue('failed'),
			remove: jest.fn().mockResolvedValue(undefined),
		};
		mockChapterScrapingQueue.getJob.mockResolvedValue(existingJob);
		mockChapterScrapingQueue.add.mockResolvedValue(undefined);

		await service.addChapterToQueue('chapter-1');

		expect(existingJob.remove).toHaveBeenCalled();
		expect(mockChapterScrapingQueue.add).toHaveBeenCalled();
	});

	it('should skip enqueue when job is already waiting', async () => {
		const existingJob = {
			getState: jest.fn().mockResolvedValue('waiting'),
			remove: jest.fn(),
		};
		mockChapterScrapingQueue.getJob.mockResolvedValue(existingJob);

		await service.addChapterToQueue('chapter-1');

		expect(mockChapterScrapingQueue.add).not.toHaveBeenCalled();
	});

	it('should ignore duplicate job error from queue', async () => {
		mockChapterScrapingQueue.getJob.mockResolvedValue(null);
		mockChapterScrapingQueue.add.mockRejectedValue(
			new Error('Job with this id already exists'),
		);

		await expect(
			service.addChapterToQueue('chapter-1'),
		).resolves.toBeUndefined();
	});

	it('should throw non-duplicate queue errors', async () => {
		mockChapterScrapingQueue.getJob.mockResolvedValue(null);
		mockChapterScrapingQueue.add.mockRejectedValue(
			new Error('unexpected queue error'),
		);

		await expect(service.addChapterToQueue('chapter-1')).rejects.toThrow(
			'unexpected queue error',
		);
	});

	it('should schedule all pending chapters', async () => {
		mockChapterRepository.find.mockResolvedValue([
			{ id: 'chapter-1' },
			{ id: 'chapter-2' },
		]);
		const addChapterSpy = jest
			.spyOn(service, 'addChapterToQueue')
			.mockResolvedValue(undefined);

		await service.scheduleAllPendingChapters();

		expect(mockChapterRepository.find).toHaveBeenCalled();
		expect(addChapterSpy).toHaveBeenNthCalledWith(1, 'chapter-1');
		expect(addChapterSpy).toHaveBeenNthCalledWith(2, 'chapter-2');
		expect(addChapterSpy).toHaveBeenCalledTimes(2);
	});
});
