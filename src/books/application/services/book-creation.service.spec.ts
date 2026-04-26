import { Test, type TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';
import { BookCreationService } from './book-creation.service';
import { BookRelationshipService } from './book-relationship.service';
import { ChapterManagementService } from './chapter-management.service';
import { CoverImageService } from '../../infrastructure/jobs/cover-image.service';
import { I_BOOK_REPOSITORY } from '../ports/book-repository.interface';
import { I_CHAPTER_REPOSITORY } from '../ports/chapter-repository.interface';
import { I_UNIT_OF_WORK } from 'src/common/application/ports/unit-of-work.interface';
import { BookEvents } from '../../domain/constants/events.constant';
import { Book } from '../../domain/entities/book';

describe('BookCreationService', () => {
	let service: BookCreationService;
	let eventEmitter: EventEmitter2;
	let chapterManagementService: ChapterManagementService;

	const mockBookRepository = {
		checkBookTitleConflict: jest.fn(),
		save: jest.fn(),
	};

	const mockChapterRepository = {
		create: jest.fn(),
		saveAll: jest.fn(),
	};

	const mockUnitOfWork = {
		runInTransaction: jest.fn((cb) =>
			cb({
				getBookRepository: () => mockBookRepository,
				getChapterRepository: () => mockChapterRepository,
				getTagRepository: () => mockBookRelationshipService,
				getAuthorRepository: () => mockBookRelationshipService,
				getSensitiveContentRepository: () =>
					mockBookRelationshipService,
			}),
		),
	};

	const mockBookRelationshipService = {
		findOrCreateTags: jest.fn(),
		findOrCreateAuthors: jest.fn(),
		findOrCreateSensitiveContent: jest.fn(),
	};

	const mockChapterManagementService = {
		createChaptersFromDto: jest.fn(),
	};

	const mockCoverImageService = {
		addCoverToQueue: jest.fn(),
	};

	const mockEventEmitter = {
		emit: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BookCreationService,
				{
					provide: I_BOOK_REPOSITORY,
					useValue: mockBookRepository,
				},
				{
					provide: I_CHAPTER_REPOSITORY,
					useValue: mockChapterRepository,
				},
				{
					provide: I_UNIT_OF_WORK,
					useValue: mockUnitOfWork,
				},
				{
					provide: BookRelationshipService,
					useValue: mockBookRelationshipService,
				},
				{
					provide: ChapterManagementService,
					useValue: mockChapterManagementService,
				},
				{
					provide: CoverImageService,
					useValue: mockCoverImageService,
				},
				{
					provide: EventEmitter2,
					useValue: mockEventEmitter,
				},
			],
		}).compile();

		service = module.get<BookCreationService>(BookCreationService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		chapterManagementService = module.get<ChapterManagementService>(
			ChapterManagementService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('createBook', () => {
		it('should emit BookEvents.CREATED with chapters when chapters are provided in DTO', async () => {
			const dto = {
				title: 'Test Book',
				chapters: [
					{
						title: 'Chapter 1',
						index: 1,
						url: 'http://example.com/1',
					},
				],
			} as any;

			const savedBook = new Book();
			savedBook.id = 'book-id';
			savedBook.title = 'Test Book';
			savedBook.chapters = [];

			const createdChapters = [
				{ id: 'chapter-id', title: 'Chapter 1', index: 1 } as any,
			];

			mockBookRepository.checkBookTitleConflict.mockResolvedValue({
				conflict: false,
			});
			mockBookRepository.save.mockResolvedValue(savedBook);
			mockChapterManagementService.createChaptersFromDto.mockResolvedValue(
				createdChapters,
			);

			await service.createBook(dto);

			// Verify event was emitted with chapters
			expect(mockEventEmitter.emit).toHaveBeenCalledWith(
				BookEvents.CREATED,
				expect.objectContaining({
					id: 'book-id',
					chapters: createdChapters,
				}),
			);

			expect(savedBook.chapters).toBe(createdChapters);
		});

		it('should throw BadRequestException if title conflict exists', async () => {
			const dto = { title: 'Existing Book' } as any;
			mockBookRepository.checkBookTitleConflict.mockResolvedValue({
				conflict: true,
				existingBook: { id: 'existing-id' },
			});

			await expect(service.createBook(dto)).rejects.toThrow(
				BadRequestException,
			);
		});
	});
});
