import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { I_BOOK_REPOSITORY } from '@books/application/ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '@books/application/ports/chapter-repository.interface';
import { I_COVER_REPOSITORY } from '@books/application/ports/cover-repository.interface';
import { I_PAGE_REPOSITORY } from '@books/application/ports/page-repository.interface';
import { BookDeletionService } from './book-deletion.service';

describe('BookDeletionService', () => {
	let service: BookDeletionService;
	let bookRepository: any;
	let chapterRepository: any;
	let coverRepository: any;
	let pageRepository: any;

	beforeEach(async () => {
		bookRepository = {
			findById: jest.fn(),
			softDelete: jest.fn(),
		};

		chapterRepository = {
			findById: jest.fn(),
			softRemove: jest.fn(),
		};

		coverRepository = {
			findById: jest.fn(),
			softRemove: jest.fn(),
		};

		pageRepository = {
			softRemove: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookDeletionService,
				{
					provide: I_BOOK_REPOSITORY,
					useValue: bookRepository,
				},
				{
					provide: I_CHAPTER_REPOSITORY,
					useValue: chapterRepository,
				},
				{
					provide: I_COVER_REPOSITORY,
					useValue: coverRepository,
				},
				{
					provide: I_PAGE_REPOSITORY,
					useValue: pageRepository,
				},
				{
					provide: EventEmitter2,
					useValue: { emit: jest.fn() },
				},
				{
					provide: DataSource,
					useValue: {},
				},
			],
		}).compile();

		service = module.get<BookDeletionService>(BookDeletionService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('deleteBook', () => {
		it('should delete a book successfully', async () => {
			// Arrange
			const bookId = 'book-1';
			bookRepository.findById.mockResolvedValue({ id: bookId });
			bookRepository.softDelete.mockResolvedValue(undefined);

			// Act
			const result = await service.deleteBook(bookId);

			// Assert
			expect(bookRepository.findById).toHaveBeenCalledWith(bookId);
			expect(bookRepository.softDelete).toHaveBeenCalledWith(bookId);
			expect(result).toEqual({
				filesScheduledForDeletion: 0,
				success: true,
			});
		});

		it('should throw NotFoundException if book is not found', async () => {
			// Arrange
			const bookId = 'book-1';
			bookRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(service.deleteBook(bookId)).rejects.toThrow(
				NotFoundException,
			);
			expect(bookRepository.softDelete).not.toHaveBeenCalled();
		});
	});

	describe('deleteBooks', () => {
		it('should delete multiple books successfully', async () => {
			// Arrange
			const bookIds = ['book-1', 'book-2'];
			bookRepository.findById.mockResolvedValue({ id: 'any' });
			bookRepository.softDelete.mockResolvedValue(undefined);

			// Act
			const result = await service.deleteBooks(bookIds);

			// Assert
			expect(bookRepository.findById).toHaveBeenCalledTimes(2);
			expect(bookRepository.softDelete).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				filesScheduledForDeletion: 0,
				success: true,
			});
		});

		it('should throw BadRequestException if no ids are provided', async () => {
			// Act & Assert
			await expect(service.deleteBooks([])).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw BadRequestException if more than 100 ids are provided', async () => {
			// Arrange
			const bookIds = Array(101).fill('book-id');

			// Act & Assert
			await expect(service.deleteBooks(bookIds)).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('deleteChapter', () => {
		it('should delete a chapter successfully', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			const chapterMock = { id: chapterId, pages: [], book: {} };
			chapterRepository.findById.mockResolvedValue(chapterMock);
			chapterRepository.softRemove.mockResolvedValue(undefined);

			// Act
			const result = await service.deleteChapter(chapterId);

			// Assert
			expect(chapterRepository.findById).toHaveBeenCalledWith(chapterId, [
				'pages',
				'book',
			]);
			expect(chapterRepository.softRemove).toHaveBeenCalledWith(
				chapterMock,
			);
			expect(result).toEqual({
				filesScheduledForDeletion: 0,
				success: true,
			});
		});

		it('should throw NotFoundException if chapter is not found', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			chapterRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(service.deleteChapter(chapterId)).rejects.toThrow(
				NotFoundException,
			);
			expect(chapterRepository.softRemove).not.toHaveBeenCalled();
		});
	});

	describe('deleteChapters', () => {
		it('should delete multiple chapters successfully', async () => {
			// Arrange
			const chapterIds = ['chapter-1', 'chapter-2'];
			const chapterMock = { id: 'any', pages: [], book: {} };
			chapterRepository.findById.mockResolvedValue(chapterMock);
			chapterRepository.softRemove.mockResolvedValue(undefined);

			// Act
			const result = await service.deleteChapters(chapterIds);

			// Assert
			expect(chapterRepository.findById).toHaveBeenCalledTimes(2);
			expect(chapterRepository.softRemove).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				filesScheduledForDeletion: 0,
				success: true,
			});
		});

		it('should throw BadRequestException if no ids are provided', async () => {
			// Act & Assert
			await expect(service.deleteChapters([])).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('deleteCover', () => {
		it('should delete a cover successfully', async () => {
			// Arrange
			const coverId = 'cover-1';
			const coverMock = { id: coverId };
			coverRepository.findById.mockResolvedValue(coverMock);
			coverRepository.softRemove.mockResolvedValue(undefined);

			// Act
			await service.deleteCover(coverId);

			// Assert
			expect(coverRepository.findById).toHaveBeenCalledWith(coverId);
			expect(coverRepository.softRemove).toHaveBeenCalledWith(coverMock);
		});

		it('should throw NotFoundException if cover is not found', async () => {
			// Arrange
			const coverId = 'cover-1';
			coverRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(service.deleteCover(coverId)).rejects.toThrow(
				NotFoundException,
			);
			expect(coverRepository.softRemove).not.toHaveBeenCalled();
		});
	});

	describe('deleteCovers', () => {
		it('should delete multiple covers successfully', async () => {
			// Arrange
			const coverIds = ['cover-1', 'cover-2'];
			const coverMock = { id: 'any' };
			coverRepository.findById.mockResolvedValue(coverMock);
			coverRepository.softRemove.mockResolvedValue(undefined);

			// Act
			const result = await service.deleteCovers(coverIds);

			// Assert
			expect(coverRepository.findById).toHaveBeenCalledTimes(2);
			expect(coverRepository.softRemove).toHaveBeenCalledTimes(2);
			expect(result).toEqual({
				filesScheduledForDeletion: 0,
				success: true,
			});
		});

		it('should throw BadRequestException if no ids are provided', async () => {
			// Act & Assert
			await expect(service.deleteCovers([])).rejects.toThrow(
				BadRequestException,
			);
		});
	});

	describe('deletePages', () => {
		it('should delete specific pages successfully', async () => {
			// Arrange
			const chapterId = 'chapter-1';
			const pageIndices = [1, 2];
			const chapterMock = {
				id: chapterId,
				pages: [
					{ id: 'page-1', index: 1 },
					{ id: 'page-2', index: 2 },
					{ id: 'page-3', index: 3 },
				],
			};
			chapterRepository.findById.mockResolvedValue(chapterMock);
			pageRepository.softRemove.mockResolvedValue(undefined);

			// Act
			await service.deletePages(chapterId, pageIndices);

			// Assert
			expect(chapterRepository.findById).toHaveBeenCalledWith(chapterId, [
				'pages',
			]);
			expect(pageRepository.softRemove).toHaveBeenCalledWith([
				{ id: 'page-1', index: 1 },
				{ id: 'page-2', index: 2 },
			]);
		});

		it('should throw BadRequestException if no page indices are provided', async () => {
			// Act & Assert
			await expect(service.deletePages('chapter-1', [])).rejects.toThrow(
				BadRequestException,
			);
		});

		it('should throw NotFoundException if chapter is not found', async () => {
			// Arrange
			chapterRepository.findById.mockResolvedValue(null);

			// Act & Assert
			await expect(
				service.deletePages('chapter-1', [1, 2]),
			).rejects.toThrow(NotFoundException);
		});
	});
});
