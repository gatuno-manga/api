import { RedisService } from '@/infrastructure/redis/redis.service';
import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_COMMENT_REPOSITORY } from '@books/application/ports/chapter-comment-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { BookContentUpdateService } from '@books/application/services/book-content-update.service';
import { BookCreationService } from '@books/application/services/book-creation.service';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ChapterScrapingSharedService } from '@books/infrastructure/jobs/chapter-scraping.shared';
import { MediaUrlService } from '@common/services/media-url.service';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Cover } from '../database/entities/cover.entity';
import { BooksKafkaConsumer } from './books-kafka.consumer';

describe('BooksKafkaConsumer', () => {
	let consumer: BooksKafkaConsumer;
	let coverRepositoryMock: any;
	let redisServiceMock: any;
	let redisClientMock: any;

	beforeEach(async () => {
		coverRepositoryMock = {
			findByBookId: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
		};

		redisClientMock = {
			get: jest.fn(),
			del: jest.fn().mockResolvedValue(undefined),
		};

		redisServiceMock = {
			getClient: jest.fn().mockReturnValue(redisClientMock),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BooksKafkaConsumer,
				{
					provide: BookContentUpdateService,
					useValue: {},
				},
				{
					provide: BookCreationService,
					useValue: {},
				},
				{
					provide: ChapterScrapingSharedService,
					useValue: {},
				},
				{
					provide: MediaUrlService,
					useValue: {},
				},
				{
					provide: RedisService,
					useValue: redisServiceMock,
				},
				{
					provide: I_BOOK_REPOSITORY,
					useValue: {},
				},
				{
					provide: I_CHAPTER_REPOSITORY,
					useValue: {},
				},
				{
					provide: I_COVER_REPOSITORY,
					useValue: coverRepositoryMock,
				},
				{
					provide: I_CHAPTER_COMMENT_REPOSITORY,
					useValue: {},
				},
			],
		}).compile();

		consumer = module.get<BooksKafkaConsumer>(BooksKafkaConsumer);

		// Suppress logs during tests
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
	});

	describe('handleCoversScrapingCompleted', () => {
		it('should correctly map metadata preventing nesting and correctly match by originalUrl', async () => {
			const bookId = 'book-123';
			const cover1 = new Cover();
			cover1.id = 'cover-1';
			cover1.scrapingStatus = ScrapingStatus.PROCESS;
			cover1.originalUrl = 'https://source/cover1.jpg';
			cover1.url = '';

			const cover2 = new Cover();
			cover2.id = 'cover-2';
			cover2.scrapingStatus = ScrapingStatus.PROCESS;
			cover2.originalUrl = 'https://source/cover2.jpg';
			cover2.url = '';

			coverRepositoryMock.findByBookId.mockResolvedValue([
				cover1,
				cover2,
			]);

			// Simulate that the Go Scraper returned results out of order but with originalUrl
			const message = {
				value: Buffer.from(
					JSON.stringify({
						bookId,
						results: [
							{
								originalUrl: 'https://source/cover2.jpg',
								path: 'processing/uuid-2.webp',
							},
							{
								originalUrl: 'https://source/cover1.jpg',
								path: 'processing/uuid-1.webp',
							},
						],
					}),
				),
			};

			// Simulate Redis cache returning nested object created by file-processor
			redisClientMock.get.mockImplementation(async (key: string) => {
				if (key === 'pending_optimization:processing/uuid-1.webp') {
					return JSON.stringify({
						path: 'books/uuid-1.webp',
						metadata: { width: 100, height: 200 },
					});
				}
				if (key === 'pending_optimization:processing/uuid-2.webp') {
					return JSON.stringify({
						path: 'books/uuid-2.webp',
						metadata: { width: 300, height: 400 },
					});
				}
				return null;
			});

			await consumer.handleCoversScrapingCompleted([message as any]);

			expect(coverRepositoryMock.save).toHaveBeenCalledTimes(2);

			// Check cover 2 which was received FIRST in results
			expect(cover2.url).toBe('books/uuid-2.webp');
			expect(cover2.metadata).toEqual({ width: 300, height: 400 });
			expect(cover2.scrapingStatus).toBe(ScrapingStatus.READY);

			// Check cover 1 which was received SECOND in results
			expect(cover1.url).toBe('books/uuid-1.webp');
			expect(cover1.metadata).toEqual({ width: 100, height: 200 });
			expect(cover1.scrapingStatus).toBe(ScrapingStatus.READY);
		});
	});
});
