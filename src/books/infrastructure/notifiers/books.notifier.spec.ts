import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { BooksNotifier } from './books.notifier';
import { BookEvents } from '@books/domain/constants/events.constant';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Chapter } from '@books/infrastructure/database/entities/chapter.entity';

describe('BooksNotifier', () => {
	let notifier: BooksNotifier;
	let mqttClient: jest.Mocked<ClientProxy>;

	beforeEach(async () => {
		const mockMqttClient = {
			emit: jest.fn().mockReturnValue(of({})),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BooksNotifier,
				{
					provide: 'MQTT_CLIENT',
					useValue: mockMqttClient,
				},
			],
		}).compile();

		notifier = module.get<BooksNotifier>(BooksNotifier);
		mqttClient = module.get('MQTT_CLIENT');
	});

	it('should be defined', () => {
		expect(notifier).toBeDefined();
	});

	describe('handleBookCreated', () => {
		it('should publish to admin topic when a book is created', () => {
			const book = {
				id: 'book-1',
				title: 'Test Book',
				type: 'MANGA',
				createdAt: new Date(),
			} as unknown as Book;

			notifier.handleBookCreated(book);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{
					event: BookEvents.CREATED,
					payload: {
						id: book.id,
						title: book.title,
						type: book.type,
						createdAt: book.createdAt,
					},
				},
			);
		});
	});

	describe('handleBookUpdated', () => {
		it('should publish to book topic when a book is updated', () => {
			const book = {
				id: 'book-1',
				title: 'Updated Book',
				updatedAt: new Date(),
			} as unknown as Book;

			notifier.handleBookUpdated(book);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK(book.id),
				{
					event: BookEvents.UPDATED,
					payload: {
						id: book.id,
						title: book.title,
						updatedAt: book.updatedAt,
					},
				},
			);
		});
	});

	describe('handleChaptersUpdated', () => {
		it('should publish to multiple topics when chapters are updated', () => {
			const bookId = 'book-1';
			const chapter = {
				id: 'chapter-1',
				title: 'Chapter 1',
				index: 1,
				scrapingStatus: 'COMPLETED',
				book: { id: bookId },
			} as unknown as Chapter;

			notifier.handleChaptersUpdated([chapter]);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				expect.objectContaining({ event: BookEvents.CHAPTERS_UPDATED }),
			);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK(bookId),
				expect.objectContaining({ event: BookEvents.CHAPTERS_UPDATED }),
			);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.CHAPTER(chapter.id),
				expect.objectContaining({ event: BookEvents.CHAPTER_UPDATED }),
			);
		});

		it('should handle single chapter update', () => {
			const bookId = 'book-1';
			const chapter = {
				id: 'chapter-1',
				title: 'Chapter 1',
				book: { id: bookId },
			} as unknown as Chapter;

			notifier.handleChaptersUpdated(chapter);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK(bookId),
				expect.objectContaining({ event: BookEvents.CHAPTERS_UPDATED }),
			);
		});
	});

	describe('handleChaptersFix', () => {
		it('should publish fix event to admin topic', () => {
			const bookId = 'book-1';
			const chapters = [
				{ id: 'ch-1', book: { id: bookId } },
				{ id: 'ch-2', book: { id: bookId } },
			] as any[];

			notifier.handleChaptersFix(chapters);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{
					event: BookEvents.CHAPTERS_FIX,
					payload: {
						bookId,
						chapterIds: ['ch-1', 'ch-2'],
					},
				},
			);
		});
	});

	describe('Scraping Events', () => {
		const data = { chapterId: 'ch-1', bookId: 'bk-1' };

		it('handleChapterScrapingStarted should publish to book, chapter and admin', () => {
			notifier.handleChapterScrapingStarted(data);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK(data.bookId),
				{ event: BookEvents.SCRAPING_STARTED, payload: data },
			);
			expect(mqttClient.emit).toHaveBeenCalledTimes(3);
		});

		it('handleChapterScrapingCompleted should publish completion info', () => {
			const completionData = { ...data, pagesCount: 20 };
			notifier.handleChapterScrapingCompleted(completionData);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.CHAPTER(data.chapterId),
				{
					event: BookEvents.SCRAPING_COMPLETED,
					payload: completionData,
				},
			);
		});

		it('handleChapterScrapingFailed should publish error info', () => {
			const errorData = { ...data, error: 'Timeout' };
			notifier.handleChapterScrapingFailed(errorData);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{ event: BookEvents.SCRAPING_FAILED, payload: errorData },
			);
		});
	});

	describe('Cover Events', () => {
		it('handleCoverProcessed should publish to admin', () => {
			const data = { bookId: 'bk-1', coverId: 'cv-1', url: 'http://...' };
			notifier.handleCoverProcessed(data);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{ event: BookEvents.COVER_PROCESSED, payload: data },
			);
		});

		it('handleCoverSelected should publish to book and admin', () => {
			const data = { bookId: 'bk-1', coverId: 'cv-1' };
			notifier.handleCoverSelected(data);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK(data.bookId),
				{ event: BookEvents.COVER_SELECTED, payload: data },
			);
		});
	});

	describe('handleBookDeleted', () => {
		it('should publish deletion summary to admin and book topics', () => {
			const data = {
				bookId: 'bk-1',
				bookTitle: 'Gone',
				covers: ['c1'],
				pages: ['p1', 'p2'],
			};
			notifier.handleBookDeleted(data);

			const expectedPayload = {
				bookId: 'bk-1',
				title: 'Gone',
				filesCount: 3,
			};

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{ event: BookEvents.DELETED, payload: expectedPayload },
			);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.BOOK('bk-1'),
				{ event: BookEvents.DELETED, payload: expectedPayload },
			);
		});
	});

	describe('handleChapterDeleted', () => {
		it('should publish chapter deletion to multiple topics', () => {
			const data = { chapterId: 'ch-1', bookId: 'bk-1', pages: ['p1'] };
			notifier.handleChapterDeleted(data);

			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.CHAPTER('ch-1'),
				{
					event: BookEvents.CHAPTER_DELETED,
					payload: {
						chapterId: 'ch-1',
						bookId: 'bk-1',
						pagesCount: 1,
					},
				},
			);
		});
	});

	describe('Update Flow Events', () => {
		it('handleBookUpdateStarted should publish to admin', () => {
			const data = {
				bookId: 'bk-1',
				bookTitle: 'T',
				jobId: 'j-1',
				timestamp: 123,
			};
			notifier.handleBookUpdateStarted(data);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{
					event: BookEvents.UPDATE_STARTED,
					payload: data,
				},
			);
		});

		it('handleBookUpdateCompleted should publish to admin', () => {
			const data = {
				bookId: 'bk-1',
				bookTitle: 'T',
				jobId: 'j-1',
				newChapters: 5,
				newCovers: 0,
				timestamp: 123,
			};
			notifier.handleBookUpdateCompleted(data);
			expect(mqttClient.emit).toHaveBeenCalledWith(
				MqttTopics.BOOKS.ADMIN,
				{
					event: BookEvents.UPDATE_COMPLETED,
					payload: data,
				},
			);
		});
	});
});
