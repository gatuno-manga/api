import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Book } from '../entities/book.entity';
import { BookContentUpdateService } from '../services/book-content-update.service';
import { BookUpdateProcessor } from './book-update.processor';
import { CoverImageService } from './cover-image.service';

describe('BookUpdateProcessor', () => {
	let processor: BookUpdateProcessor;

	const mockBookRepository = {
		findOne: jest.fn(),
	};

	const mockConfigService = {
		queueConcurrency: {
			bookUpdate: 4,
		},
	};

	const mockEventEmitter = {
		emit: jest.fn(),
	};

	const mockCoverImageService = {
		recalculateMissingCoverHashes: jest.fn(),
	};

	const mockBookContentUpdateService = {
		performUpdate: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookUpdateProcessor,
				{
					provide: getRepositoryToken(Book),
					useValue: mockBookRepository,
				},
				{
					provide: AppConfigService,
					useValue: mockConfigService,
				},
				{
					provide: EventEmitter2,
					useValue: mockEventEmitter,
				},
				{
					provide: CoverImageService,
					useValue: mockCoverImageService,
				},
				{
					provide: BookContentUpdateService,
					useValue: mockBookContentUpdateService,
				},
			],
		}).compile();

		processor = module.get<BookUpdateProcessor>(BookUpdateProcessor);
		Object.defineProperty(processor, 'worker', {
			value: { concurrency: 0 },
			configurable: true,
		});
	});

	it('sets worker concurrency and recalculates missing cover hashes on init', async () => {
		mockCoverImageService.recalculateMissingCoverHashes.mockResolvedValue(
			undefined,
		);

		await processor.onModuleInit();

		expect((processor as any).worker.concurrency).toBe(4);
		expect(
			mockCoverImageService.recalculateMissingCoverHashes,
		).toHaveBeenCalled();
	});

	it('delegates process execution to BookContentUpdateService', async () => {
		mockBookContentUpdateService.performUpdate.mockResolvedValue({
			newChapters: 2,
			newCovers: 1,
		});

		const result = await processor.process({
			data: { bookId: 'book-1' },
		} as any);

		expect(mockBookContentUpdateService.performUpdate).toHaveBeenCalledWith(
			'book-1',
		);
		expect(result).toEqual({ newChapters: 2, newCovers: 1 });
	});
});
