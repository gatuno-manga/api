import { InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { ChapterSubscriber } from './chapter.subscriber';

describe('ChapterSubscriber', () => {
	let subscriber: ChapterSubscriber;
	let dataSourceMock: any;
	let queryBuilderMock: any;
	let managerMock: any;

	beforeEach(() => {
		dataSourceMock = {
			subscribers: [],
		};

		queryBuilderMock = {
			where: jest.fn().mockReturnThis(),
			select: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			groupBy: jest.fn().mockReturnThis(),
			getRawMany: jest.fn(),
		};

		managerMock = {
			createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
			update: jest.fn(),
		};

		subscriber = new ChapterSubscriber(dataSourceMock);
	});

	it('should register itself as a subscriber', () => {
		expect(dataSourceMock.subscribers).toContain(subscriber);
	});

	it('should listen to Chapter entity', () => {
		expect(subscriber.listenTo()).toBe(Chapter);
	});

	describe('afterInsert, afterUpdate, afterRemove', () => {
		it('should update book chapter stats correctly', async () => {
			// Arrange
			const eventMock = {
				entity: {
					book: { id: 'book-1' },
				},
				manager: managerMock,
			} as unknown as InsertEvent<Chapter>;

			queryBuilderMock.getRawMany.mockResolvedValue([
				{ language: 'pt-BR', count: '10' },
				{ language: 'en', count: '15' },
				{ language: 'es', count: null }, // edge case: no chapters returned properly
			]);

			// Act
			await subscriber.afterInsert(eventMock);

			// Assert
			expect(managerMock.createQueryBuilder).toHaveBeenCalledWith(
				Chapter,
				'chapter',
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith(
				'chapter.bookId = :bookId',
				{ bookId: 'book-1' },
			);

			expect(managerMock.update).toHaveBeenCalledWith(Book, 'book-1', {
				totalChapters: 15,
				chaptersPerLanguage: [
					{ language: 'pt-BR', count: 10 },
					{ language: 'en', count: 15 },
					{ language: 'es', count: 0 },
				],
			});
		});

		it('should do nothing if book is not defined on the entity', async () => {
			// Arrange
			const eventMock = {
				entity: {},
				manager: managerMock,
			} as unknown as UpdateEvent<Chapter>;

			// Act
			await subscriber.afterUpdate(eventMock);

			// Assert
			expect(managerMock.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('should handle remove event', async () => {
			// Arrange
			const eventMock = {
				entity: {
					book: { id: 'book-2' },
				},
				manager: managerMock,
			} as unknown as RemoveEvent<Chapter>;

			queryBuilderMock.getRawMany.mockResolvedValue([]);

			// Act
			await subscriber.afterRemove(eventMock);

			// Assert
			expect(managerMock.update).toHaveBeenCalledWith(Book, 'book-2', {
				totalChapters: 0,
				chaptersPerLanguage: [],
			});
		});
	});
});
