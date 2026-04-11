import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Chapter } from '../entities/chapter.entity';
import { ChapterScrapingJob } from './chapter-scraping.job';
import { ChapterScrapingSharedService } from './chapter-scraping.shared';

describe('ChapterScrapingJob', () => {
	let jobProcessor: ChapterScrapingJob;

	let mockQueryRunner: any;

	const mockChapterRepository = {};

	const mockDataSource = {
		createQueryRunner: jest.fn(),
	};

	const mockConfigService = {
		queueConcurrency: {
			chapterScraping: 3,
		},
	};

	const mockChapterScrapingShared = {
		processChapterPages: jest.fn(),
		emitStartedEvent: jest.fn(),
		emitFailedEvent: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		mockQueryRunner = {
			connect: jest.fn().mockResolvedValue(undefined),
			release: jest.fn().mockResolvedValue(undefined),
			manager: {
				findOne: jest.fn(),
				save: jest.fn(),
			},
		};
		mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChapterScrapingJob,
				{
					provide: getRepositoryToken(Chapter),
					useValue: mockChapterRepository,
				},
				{
					provide: DataSource,
					useValue: mockDataSource,
				},
				{
					provide: AppConfigService,
					useValue: mockConfigService,
				},
				{
					provide: ChapterScrapingSharedService,
					useValue: mockChapterScrapingShared,
				},
			],
		}).compile();

		jobProcessor = module.get<ChapterScrapingJob>(ChapterScrapingJob);
		Object.defineProperty(jobProcessor, 'worker', {
			value: { concurrency: 0 },
			configurable: true,
		});
	});

	it('sets worker concurrency on module init', () => {
		jobProcessor.onModuleInit();

		expect((jobProcessor as any).worker.concurrency).toBe(3);
	});

	it('processes chapter when chapter exists', async () => {
		const chapter = {
			id: 'chapter-1',
			book: { id: 'book-1' },
			pages: [],
		};
		mockQueryRunner.manager.findOne.mockResolvedValue(chapter);
		mockChapterScrapingShared.processChapterPages.mockResolvedValue(
			undefined,
		);

		await jobProcessor.process({
			id: 'job-1',
			data: 'chapter-1',
		} as any);

		expect(mockQueryRunner.manager.findOne).toHaveBeenCalled();
		expect(
			mockChapterScrapingShared.processChapterPages,
		).toHaveBeenCalledWith(chapter);
		expect(mockQueryRunner.release).toHaveBeenCalled();
	});

	it('throws when chapter does not exist and still releases query runner', async () => {
		mockQueryRunner.manager.findOne.mockResolvedValue(null);

		await expect(
			jobProcessor.process({
				id: 'job-1',
				data: 'missing-chapter',
			} as any),
		).rejects.toThrow('Capítulo com ID missing-chapter não encontrado.');

		expect(mockQueryRunner.release).toHaveBeenCalled();
	});
});
