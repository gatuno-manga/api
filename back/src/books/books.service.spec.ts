import { Test, TestingModule } from '@nestjs/testing';
import { BooksService } from './books.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Book } from './entitys/book.entity';
import { Tag } from './entitys/tags.entity';
import { Author } from './entitys/author.entity';
import { SensitiveContent } from './entitys/sensitive-content.entity';
import { BookCreationService } from './services/book-creation.service';
import { BookUpdateService } from './services/book-update.service';
import { BookQueryService } from './services/book-query.service';
import { ChapterManagementService } from './services/chapter-management.service';
import { BookRelationshipService } from './services/book-relationship.service';

describe('BooksService', () => {
	let service: BooksService;

	const mockBookRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
	};

	const mockTagRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
	};

	const mockAuthorRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
	};

	const mockSensitiveContentRepository = {
		find: jest.fn(),
		findOne: jest.fn(),
		save: jest.fn(),
	};

	const mockBookCreationService = {
		createBook: jest.fn(),
		checkBookTitleConflict: jest.fn(),
	};

	const mockBookUpdateService = {
		updateBook: jest.fn(),
	};

	const mockBookQueryService = {
		getAllBooks: jest.fn(),
		getRandomBook: jest.fn(),
		getOne: jest.fn(),
		findAllBooks: jest.fn(),
		findOneBook: jest.fn(),
	};

	const mockChapterManagementService = {
		addChapter: jest.fn(),
		updateChapter: jest.fn(),
		deleteChapter: jest.fn(),
	};

	const mockBookRelationshipService = {
		addTags: jest.fn(),
		addAuthors: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				BooksService,
				{
					provide: getRepositoryToken(Book),
					useValue: mockBookRepository,
				},
				{
					provide: getRepositoryToken(Tag),
					useValue: mockTagRepository,
				},
				{
					provide: getRepositoryToken(Author),
					useValue: mockAuthorRepository,
				},
				{
					provide: getRepositoryToken(SensitiveContent),
					useValue: mockSensitiveContentRepository,
				},
				{
					provide: BookCreationService,
					useValue: mockBookCreationService,
				},
				{
					provide: BookUpdateService,
					useValue: mockBookUpdateService,
				},
				{
					provide: BookQueryService,
					useValue: mockBookQueryService,
				},
				{
					provide: ChapterManagementService,
					useValue: mockChapterManagementService,
				},
				{
					provide: BookRelationshipService,
					useValue: mockBookRelationshipService,
				},
			],
		}).compile();

		service = module.get<BooksService>(BooksService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should have logger initialized', () => {
		expect(service['logger']).toBeDefined();
	});

	it('should have filter strategies initialized', () => {
		expect(service['filterStrategies']).toBeDefined();
		expect(service['filterStrategies'].length).toBeGreaterThan(0);
	});

	describe('createBook', () => {
		it('should call bookCreationService.createBook with dto', async () => {
			const dto = { title: 'Test Book' } as any;
			const mockResult = { id: '1', title: 'Test Book' };
			mockBookCreationService.createBook.mockResolvedValue(mockResult);

			const result = await service.createBook(dto);

			expect(mockBookCreationService.createBook).toHaveBeenCalledWith(dto);
			expect(result).toEqual(mockResult);
		});
	});

	describe('checkBookTitleConflict', () => {
		it('should call bookCreationService.checkBookTitleConflict', async () => {
			const title = 'Test Book';
			const altTitles = ['Alt1', 'Alt2'];
			const mockResult = { conflict: false };
			mockBookCreationService.checkBookTitleConflict.mockResolvedValue(mockResult);

			const result = await service.checkBookTitleConflict(title, altTitles);

			expect(mockBookCreationService.checkBookTitleConflict).toHaveBeenCalledWith(title, altTitles);
			expect(result).toEqual(mockResult);
		});

		it('should use empty array as default for alternativeTitles', async () => {
			const title = 'Test Book';
			mockBookCreationService.checkBookTitleConflict.mockResolvedValue({ conflict: false });

			await service.checkBookTitleConflict(title);

			expect(mockBookCreationService.checkBookTitleConflict).toHaveBeenCalledWith(title, []);
		});
	});

	describe('updateBook', () => {
		it('should call bookUpdateService.updateBook', async () => {
			const id = 'test-id';
			const dto = { title: 'Updated Title' } as any;
			const mockResult = { id, title: 'Updated Title' };
			mockBookUpdateService.updateBook.mockResolvedValue(mockResult);

			const result = await service.updateBook(id, dto);

			expect(mockBookUpdateService.updateBook).toHaveBeenCalledWith(id, dto);
			expect(result).toEqual(mockResult);
		});
	});

	describe('getAllBooks', () => {
		it('should call bookQueryService.getAllBooks', async () => {
			const options = { page: 1, take: 10 } as any;
			const maxWeight = 5;
			const mockResult = { data: [], meta: {} } as any;
			mockBookQueryService.getAllBooks.mockResolvedValue(mockResult);

			const result = await service.getAllBooks(options, maxWeight);

			expect(mockBookQueryService.getAllBooks).toHaveBeenCalledWith(
				options,
				maxWeight,
				expect.any(Array)
			);
			expect(result).toEqual(mockResult);
		});

		it('should use 0 as default maxWeightSensitiveContent', async () => {
			const options = { page: 1, take: 10 } as any;
			mockBookQueryService.getAllBooks.mockResolvedValue({ data: [], meta: {} });

			await service.getAllBooks(options);

			expect(mockBookQueryService.getAllBooks).toHaveBeenCalledWith(
				options,
				0,
				expect.any(Array)
			);
		});
	});

	describe('getOne', () => {
		it('should call bookQueryService.getOne', async () => {
			const id = 'test-id';
			const maxWeight = 5;
			const mockBook = { id, title: 'Test Book' };
			mockBookQueryService.getOne.mockResolvedValue(mockBook);

			const result = await service.getOne(id, maxWeight);

			expect(mockBookQueryService.getOne).toHaveBeenCalledWith(id, maxWeight);
			expect(result).toEqual(mockBook);
		});
	});
});
