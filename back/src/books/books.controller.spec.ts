import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

describe('BooksController', () => {
	let controller: BooksController;
	let booksService: BooksService;

	const mockBooksService = {
		getAllBooks: jest.fn(),
		getRandomBook: jest.fn(),
		getOne: jest.fn(),
		getChapters: jest.fn(),
		getCovers: jest.fn(),
		getInfos: jest.fn(),
		checkBookTitleConflict: jest.fn(),
		findAll: jest.fn(),
		findOne: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		remove: jest.fn(),
		search: jest.fn(),
	};

	const mockCacheManager = {
		get: jest.fn(),
		set: jest.fn(),
		del: jest.fn(),
		reset: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [BooksController],
			providers: [
				{
					provide: BooksService,
					useValue: mockBooksService,
				},
				{
					provide: CACHE_MANAGER,
					useValue: mockCacheManager,
				},
			],
		}).compile();

		controller = module.get<BooksController>(BooksController);
		booksService = module.get<BooksService>(BooksService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should have booksService injected', () => {
		expect(booksService).toBeDefined();
	});

	describe('getAllBooks', () => {
		it('should call booksService.getAllBooks with pageOptions', async () => {
			const pageOptions = { page: 1, take: 10 } as any;
			const mockResult = { data: [], meta: {} };
			mockBooksService.getAllBooks.mockResolvedValue(mockResult);

			const result = await controller.getAllBooks(pageOptions);

			expect(booksService.getAllBooks).toHaveBeenCalledWith(pageOptions, undefined);
			expect(result).toEqual(mockResult);
		});

		it('should pass user maxWeightSensitiveContent when user is provided', async () => {
			const pageOptions = { page: 1, take: 10 } as any;
			const user = { maxWeightSensitiveContent: 5 } as any;
			const mockResult = { data: [], meta: {} };
			mockBooksService.getAllBooks.mockResolvedValue(mockResult);

			await controller.getAllBooks(pageOptions, user);

			expect(booksService.getAllBooks).toHaveBeenCalledWith(pageOptions, 5);
		});
	});

	describe('getRandomBook', () => {
		it('should call booksService.getRandomBook with options', async () => {
			const options = { page: 1, take: 10 } as any;
			const mockBook = { id: '1', title: 'Test Book' };
			mockBooksService.getRandomBook.mockResolvedValue(mockBook);

			const result = await controller.getRandomBook(options);

			expect(booksService.getRandomBook).toHaveBeenCalledWith(options, undefined);
			expect(result).toEqual(mockBook);
		});
	});

	describe('checkBookTitle', () => {
		it('should call booksService.checkBookTitleConflict with title', async () => {
			const title = 'Test Book';
			const mockResult = { conflict: false };
			mockBooksService.checkBookTitleConflict.mockResolvedValue(mockResult);

			const result = await controller.checkBookTitle(title);

			expect(booksService.checkBookTitleConflict).toHaveBeenCalledWith(title, undefined);
			expect(result).toEqual(mockResult);
		});

		it('should parse alternativeTitles when provided', async () => {
			const title = 'Test Book';
			const alternativeTitles = 'Alt1,Alt2,Alt3';
			mockBooksService.checkBookTitleConflict.mockResolvedValue({ conflict: false });

			await controller.checkBookTitle(title, alternativeTitles);

			expect(booksService.checkBookTitleConflict).toHaveBeenCalledWith(
				title,
				['Alt1', 'Alt2', 'Alt3']
			);
		});
	});

	describe('getBook', () => {
		it('should call booksService.getOne with id', async () => {
			const id = 'test-id';
			const mockBook = { id, title: 'Test Book' };
			mockBooksService.getOne.mockResolvedValue(mockBook);

			const result = await controller.getBook(id);

			expect(booksService.getOne).toHaveBeenCalledWith(id, undefined);
			expect(result).toEqual(mockBook);
		});

		it('should pass maxWeightSensitiveContent when user is provided', async () => {
			const id = 'test-id';
			const user = { maxWeightSensitiveContent: 5 } as any;
			mockBooksService.getOne.mockResolvedValue({});

			await controller.getBook(id, user);

			expect(booksService.getOne).toHaveBeenCalledWith(id, 5);
		});
	});

	describe('getBookChapters', () => {
		it('should call booksService.getChapters with id', async () => {
			const id = 'test-id';
			const mockChapters = [{ id: '1', title: 'Chapter 1' }];
			mockBooksService.getChapters.mockResolvedValue(mockChapters);

			const result = await controller.getBookChapters(id);

			expect(booksService.getChapters).toHaveBeenCalledWith(id, undefined, undefined);
			expect(result).toEqual(mockChapters);
		});

		it('should pass userId and maxWeight when user is provided', async () => {
			const id = 'test-id';
			const user = { userId: 'user-1', maxWeightSensitiveContent: 5 } as any;
			mockBooksService.getChapters.mockResolvedValue([]);

			await controller.getBookChapters(id, user);

			expect(booksService.getChapters).toHaveBeenCalledWith(id, 'user-1', 5);
		});
	});

	describe('getBookCovers', () => {
		it('should call booksService.getCovers with id', async () => {
			const id = 'test-id';
			const mockCovers = [{ id: '1', url: 'cover.jpg' }];
			mockBooksService.getCovers.mockResolvedValue(mockCovers);

			const result = await controller.getBookCovers(id);

			expect(booksService.getCovers).toHaveBeenCalledWith(id, undefined);
			expect(result).toEqual(mockCovers);
		});
	});

	describe('getBookInfos', () => {
		it('should call booksService.getInfos with id', async () => {
			const id = 'test-id';
			const mockInfos = { views: 100, likes: 50 };
			mockBooksService.getInfos.mockResolvedValue(mockInfos);

			const result = await controller.getBookInfos(id);

			expect(booksService.getInfos).toHaveBeenCalledWith(id, undefined);
			expect(result).toEqual(mockInfos);
		});
	});
});
