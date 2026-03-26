import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { ChapterManagementService } from './chapter-management.service';
import { Book } from '../entities/book.entity';
import { Chapter } from '../entities/chapter.entity';
import { ContentFormat } from '../enum/content-format.enum';
import { ExportFormat } from '../enum/export-format.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ChapterManagementService', () => {
	let service: ChapterManagementService;
	let bookRepository: any;
	let chapterRepository: any;
	let dataSource: any;
	let eventEmitter: any;

	const mockBookId = 'book-1';
	const mockChapterId = 'chapter-1';

	beforeEach(async () => {
		bookRepository = {
			findOne: jest.fn(),
			save: jest.fn(),
		};
		chapterRepository = {
			create: jest.fn(),
			save: jest.fn(),
			findOne: jest.fn(),
			merge: jest.fn(),
		};
		eventEmitter = {
			emit: jest.fn(),
		};
		dataSource = {
			transaction: jest.fn((cb) =>
				cb({
					getRepository: (entity: any) => {
						if (entity === Book) return bookRepository;
						if (entity === Chapter) return chapterRepository;
					},
				}),
			),
			createQueryRunner: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ChapterManagementService,
				{
					provide: getRepositoryToken(Chapter),
					useValue: chapterRepository,
				},
				{
					provide: getRepositoryToken(Book),
					useValue: bookRepository,
				},
				{
					provide: EventEmitter2,
					useValue: eventEmitter,
				},
				{
					provide: DataSource,
					useValue: dataSource,
				},
			],
		}).compile();

		service = module.get<ChapterManagementService>(
			ChapterManagementService,
		);
	});

	describe('createManualChapterWithContent', () => {
		it('should create a chapter and NOT load/sync book chapters (Fixes bug where relation was lost)', async () => {
			const mockBook = {
				id: mockBookId,
				availableFormats: [],
			};

			const mockChapter = {
				id: mockChapterId,
				title: 'Chapter 1',
				index: 1,
				book: mockBook,
			};

			bookRepository.findOne.mockResolvedValue(mockBook);
			chapterRepository.findOne.mockResolvedValue(null);
			chapterRepository.create.mockReturnValue(mockChapter);
			chapterRepository.save.mockResolvedValue(mockChapter);
			bookRepository.save.mockResolvedValue(mockBook);

			const result = await service.createManualChapterWithContent(
				mockBookId,
				{
					title: 'Chapter 1',
					index: 1,
					content: 'Some content',
					format: ContentFormat.MARKDOWN,
				},
			);

			expect(bookRepository.save).toHaveBeenCalled();
			expect((mockBook as any).chapters).toBeUndefined(); // Should not be loaded
			expect(result.book).toBeDefined();
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				'chapter.created',
				expect.anything(),
			);
		});

		it('should throw NotFoundException if book not found', async () => {
			bookRepository.findOne.mockResolvedValue(null);

			await expect(
				service.createManualChapterWithContent(mockBookId, {
					title: 'Chapter 1',
					index: 1,
					content: 'Some content',
					format: ContentFormat.MARKDOWN,
				}),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw BadRequestException if index already exists', async () => {
			const mockBook = { id: mockBookId, availableFormats: [] };
			bookRepository.findOne.mockResolvedValue(mockBook);
			chapterRepository.findOne.mockResolvedValue({ id: 'existing' });

			await expect(
				service.createManualChapterWithContent(mockBookId, {
					title: 'Chapter 1',
					index: 1,
					content: 'Some content',
					format: ContentFormat.MARKDOWN,
				}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('createManualChaptersInBatch', () => {
		it('should process multiple chapters and return results', async () => {
			const mockBook = {
				id: mockBookId,
				availableFormats: [ExportFormat.MARKDOWN],
			};
			bookRepository.findOne.mockResolvedValue(mockBook);
			chapterRepository.findOne.mockResolvedValue(null);
			chapterRepository.create.mockImplementation((dto: any) => ({
				id: `ch-${dto.index}`,
				...dto,
			}));
			chapterRepository.save.mockImplementation((ch: any) => ch);

			const items = [
				{
					bookId: mockBookId,
					title: 'Ch 1',
					index: 1,
					content: 'C1',
					format: ContentFormat.MARKDOWN,
				},
				{
					bookId: mockBookId,
					title: 'Ch 2',
					index: 2,
					content: 'C2',
					format: ContentFormat.MARKDOWN,
				},
			];

			const result = await service.createManualChaptersInBatch(items);

			expect(result.total).toBe(2);
			expect(result.success).toBe(2);
			expect(result.results[0].status).toBe('success');
			expect(result.results[1].status).toBe('success');
		});
	});
});
