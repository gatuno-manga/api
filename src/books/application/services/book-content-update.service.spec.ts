import { RedisService } from '@/infrastructure/redis/redis.service';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { Book } from '@books/domain/entities/book';
import { Chapter } from '@books/domain/entities/chapter';
import { PublicationStatus } from '@books/domain/enums/publication-status.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { CoverImageService } from '@books/infrastructure/jobs/cover-image.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientKafka } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { WebsiteService } from '@websites/application/services/website.service';
import { BookContentUpdateService } from './book-content-update.service';

describe('BookContentUpdateService', () => {
	let service: BookContentUpdateService;
	let chapterRepository: any;

	const mockBookRepository = {
		findById: jest.fn(),
		save: jest.fn(),
		update: jest.fn(),
	};

	const mockChapterRepository = {
		findByBookId: jest.fn(),
		create: jest.fn(),
		saveAll: jest.fn(),
	};

	const mockCoverRepository = {
		save: jest.fn(),
	};

	const mockScraperClient = {
		connect: jest.fn(),
		emit: jest.fn(),
	};

	const mockWebsiteService = {
		getByUrl: jest.fn(),
	};

	const mockEventEmitter = {
		emit: jest.fn(),
	};

	const mockCoverImageService = {
		addCoverToQueue: jest.fn(),
	};

	const mockRedisService = {
		getClient: jest.fn().mockReturnValue({
			set: jest.fn(),
			del: jest.fn(),
		}),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookContentUpdateService,
				{ provide: I_BOOK_REPOSITORY, useValue: mockBookRepository },
				{
					provide: I_CHAPTER_REPOSITORY,
					useValue: mockChapterRepository,
				},
				{ provide: I_COVER_REPOSITORY, useValue: mockCoverRepository },
				{ provide: 'SCRAPER_SERVICE', useValue: mockScraperClient },
				{ provide: WebsiteService, useValue: mockWebsiteService },
				{ provide: EventEmitter2, useValue: mockEventEmitter },
				{ provide: CoverImageService, useValue: mockCoverImageService },
				{ provide: RedisService, useValue: mockRedisService },
			],
		}).compile();

		service = module.get<BookContentUpdateService>(
			BookContentUpdateService,
		);
		chapterRepository = module.get(I_CHAPTER_REPOSITORY);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('syncChapters', () => {
		it('should skip chapters with duplicate indexes', async () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				chapters: [
					{
						id: 'ch-1',
						index: 1,
						originalUrl: 'http://example.com/ch1',
					},
				] as any[],
			} as Book;

			const scrapedChapters = [
				{
					title: 'Chapter 1 (Duplicate Index)',
					url: 'http://example.com/ch1-new',
					index: 1,
				},
				{
					title: 'Chapter 2 (New)',
					url: 'http://example.com/ch2',
					index: 2,
				},
			];

			mockChapterRepository.findByBookId.mockResolvedValue([
				{ id: 'ch-1', index: 1, originalUrl: 'http://example.com/ch1' },
			]);

			mockChapterRepository.create.mockImplementation((dto) => dto);
			mockChapterRepository.saveAll.mockImplementation((entities) =>
				Promise.resolve(entities),
			);

			const result = await service.syncChapters(book, scrapedChapters);

			// Should only create Chapter 2
			expect(result).toHaveLength(1);
			expect(result[0].index).toBe(2);
			expect(result[0].title).toBe('Chapter 2 (New)');

			expect(mockChapterRepository.create).toHaveBeenCalledTimes(1);
			expect(mockChapterRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					index: 2,
					title: 'Chapter 2 (New)',
				}),
			);
		});

		it('should skip chapters with duplicate URLs', async () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				chapters: [
					{
						id: 'ch-1',
						index: 1,
						originalUrl: 'http://example.com/ch1',
					},
				] as any[],
			} as Book;

			const scrapedChapters = [
				{
					title: 'Chapter 1 (Duplicate URL)',
					url: 'http://example.com/ch1',
					index: 2,
				},
			];

			const result = await service.syncChapters(book, scrapedChapters);

			expect(result).toHaveLength(0);
			expect(mockChapterRepository.create).not.toHaveBeenCalled();
		});

		it('should skip chapters with trailing slashes in URLs', async () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				chapters: [
					{
						id: 'ch-1',
						index: 1,
						originalUrl: 'http://example.com/ch1',
					},
				] as any[],
			} as Book;

			const scrapedChapters = [
				{
					title: 'Chapter 1 (Trailing Slash)',
					url: 'http://example.com/ch1/',
					index: 1,
				},
			];

			const result = await service.syncChapters(book, scrapedChapters);

			expect(result).toHaveLength(0);
			expect(mockChapterRepository.create).not.toHaveBeenCalled();
		});

		it('should handle string indices and skip duplicates', async () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				chapters: [
					{
						id: 'ch-1',
						index: 1,
						originalUrl: 'http://example.com/ch1',
					},
				] as any[],
			} as Book;

			const scrapedChapters = [
				{
					title: 'Chapter 1 (String Index)',
					url: 'http://example.com/ch1-new',
					index: '1' as any,
				},
			];

			mockChapterRepository.findByBookId.mockResolvedValue([
				{ id: 'ch-1', index: 1, originalUrl: 'http://example.com/ch1' },
			]);

			const result = await service.syncChapters(book, scrapedChapters);

			expect(result).toHaveLength(0);
			expect(mockChapterRepository.create).not.toHaveBeenCalled();
		});

		it('should generate next available integer index if index is not provided', async () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				chapters: [
					{
						id: 'ch-1',
						index: 1,
						originalUrl: 'http://example.com/ch1',
					},
				] as any[],
			} as Book;

			const scrapedChapters = [
				{
					title: 'Chapter 2 (No Index Provided)',
					url: 'http://example.com/ch2',
				},
			];

			mockChapterRepository.findByBookId.mockResolvedValue([
				{ id: 'ch-1', index: 1, originalUrl: 'http://example.com/ch1' },
			]);

			mockChapterRepository.create.mockImplementation((dto) => dto);
			mockChapterRepository.saveAll.mockImplementation((entities) =>
				Promise.resolve(entities),
			);

			const result = await service.syncChapters(book, scrapedChapters);

			expect(result).toHaveLength(1);
			expect(result[0].index).toBe(2);
		});
	});

	describe('scheduleNextScrape', () => {
		let originalMathRandom: () => number;

		beforeAll(() => {
			jest.useFakeTimers();
			// Mock system time to a known value
			jest.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));

			originalMathRandom = Math.random;
			// Mock Math.random to return 0.5 so randomHour = 12, randomMinute = 30
			Math.random = jest.fn(() => 0.5);
		});

		afterAll(() => {
			jest.useRealTimers();
			Math.random = originalMathRandom;
		});

		afterEach(() => {
			jest.clearAllMocks();
		});

		it('should schedule next scrape to 3 days for ONGOING book with recent chapters (<= 30 days)', async () => {
			const book = {
				id: 'book-1',
				publicationStatus: PublicationStatus.ONGOING,
				lastChapterAddedAt: new Date(
					Date.now() - 3 * 24 * 60 * 60 * 1000,
				), // 3 days ago
				autoUpdate: true,
			} as Book;

			await service.scheduleNextScrape(book);

			expect(mockBookRepository.update).toHaveBeenCalledTimes(1);
			const updateArgs = mockBookRepository.update.mock.calls[0][1];
			expect(updateArgs.autoUpdate).toBe(true);

			const nextScrapeAt: Date = updateArgs.nextScrapeAt;
			// Current date is 13, + 3 days = 16
			expect(nextScrapeAt.getDate()).toBe(16);
			// Jitter applied
			expect(nextScrapeAt.getHours()).toBe(12);
			expect(nextScrapeAt.getMinutes()).toBe(30);
		});

		it('should schedule next scrape to 7 days for ONGOING book with old chapters (> 30 days)', async () => {
			const book = {
				id: 'book-1',
				publicationStatus: PublicationStatus.ONGOING,
				lastChapterAddedAt: new Date(
					Date.now() - 35 * 24 * 60 * 60 * 1000,
				), // 35 days ago
				autoUpdate: true,
			} as Book;

			await service.scheduleNextScrape(book);

			expect(mockBookRepository.update).toHaveBeenCalledTimes(1);
			const updateArgs = mockBookRepository.update.mock.calls[0][1];

			const nextScrapeAt: Date = updateArgs.nextScrapeAt;
			// Current date is 13, + 7 days = 20
			expect(nextScrapeAt.getDate()).toBe(20);
			expect(nextScrapeAt.getHours()).toBe(12);
		});

		it('should schedule next scrape to 1 month for COMPLETED book (check count < 3)', async () => {
			const book = {
				id: 'book-1',
				publicationStatus: PublicationStatus.COMPLETED,
				completedCheckCount: 1,
				autoUpdate: true,
			} as Book;

			await service.scheduleNextScrape(book);

			expect(mockBookRepository.update).toHaveBeenCalledTimes(1);
			const updateArgs = mockBookRepository.update.mock.calls[0][1];
			expect(updateArgs.completedCheckCount).toBe(2);

			const nextScrapeAt: Date = updateArgs.nextScrapeAt;
			// July (6) + 1 month = August (7)
			expect(nextScrapeAt.getMonth()).toBe(7);
			expect(nextScrapeAt.getDate()).toBe(13);
		});

		it('should schedule next scrape to 3 months for CANCELLED book (check count between 3 and 5)', async () => {
			const book = {
				id: 'book-1',
				publicationStatus: PublicationStatus.CANCELLED,
				completedCheckCount: 4,
				autoUpdate: true,
			} as Book;

			await service.scheduleNextScrape(book);

			expect(mockBookRepository.update).toHaveBeenCalledTimes(1);
			const updateArgs = mockBookRepository.update.mock.calls[0][1];
			expect(updateArgs.completedCheckCount).toBe(5);

			const nextScrapeAt: Date = updateArgs.nextScrapeAt;
			// July (6) + 3 months = October (9)
			expect(nextScrapeAt.getMonth()).toBe(9);
			expect(nextScrapeAt.getDate()).toBe(13);
		});

		it('should stop auto update for COMPLETED book after 6 checks', async () => {
			const book = {
				id: 'book-1',
				publicationStatus: PublicationStatus.COMPLETED,
				completedCheckCount: 6,
				autoUpdate: true,
			} as Book;

			await service.scheduleNextScrape(book);

			expect(mockBookRepository.update).toHaveBeenCalledTimes(1);
			const updateArgs = mockBookRepository.update.mock.calls[0][1];
			expect(updateArgs.completedCheckCount).toBe(7);
			expect(updateArgs.autoUpdate).toBe(false);
			expect(updateArgs.nextScrapeAt).toBeNull();
		});
	});
});
