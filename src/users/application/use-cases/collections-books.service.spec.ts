import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CollectionsBooksService } from './collections-books.service';
import { CollectionBook } from '@users/infrastructure/database/entities/collection-book.entity';
import { Book } from 'src/books/infrastructure/database/entities/book.entity';
import { User } from '@users/infrastructure/database/entities/user.entity';

describe('CollectionsBooksService', () => {
	let service: CollectionsBooksService;
	let collectionRepo: jest.Mocked<Repository<CollectionBook>>;
	let bookRepo: jest.Mocked<Repository<Book>>;
	let userRepo: jest.Mocked<Repository<User>>;

	const mockCollectionRepo = {
		findOne: jest.fn(),
		find: jest.fn(),
		save: jest.fn(),
		create: jest.fn(),
		remove: jest.fn(),
	};

	const mockBookRepo = {
		find: jest.fn(),
	};

	const mockUserRepo = {
		findOne: jest.fn(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CollectionsBooksService,
				{
					provide: getRepositoryToken(CollectionBook),
					useValue: mockCollectionRepo,
				},
				{
					provide: getRepositoryToken(Book),
					useValue: mockBookRepo,
				},
				{
					provide: getRepositoryToken(User),
					useValue: mockUserRepo,
				},
			],
		}).compile();

		service = module.get<CollectionsBooksService>(CollectionsBooksService);
		collectionRepo = module.get(getRepositoryToken(CollectionBook));
		bookRepo = module.get(getRepositoryToken(Book));
		userRepo = module.get(getRepositoryToken(User));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('createCollectionBook', () => {
		it('should create a collection successfully', async () => {
			const userId = 'u1';
			const dto = { title: 'My Favs', description: 'desc' };
			mockUserRepo.findOne.mockResolvedValue({ id: userId } as any);
			mockCollectionRepo.create.mockReturnValue({
				...dto,
				user: { id: userId },
			} as any);
			mockCollectionRepo.save.mockResolvedValue({
				id: 'c1',
				...dto,
			} as any);

			const result = await service.createCollectionBook(
				dto as any,
				userId,
			);

			expect(result.id).toBe('c1');
			expect(mockCollectionRepo.save).toHaveBeenCalled();
		});

		it('should throw NotFoundException if user not found', async () => {
			mockUserRepo.findOne.mockResolvedValue(null);
			await expect(
				service.createCollectionBook({ title: 'T' }, 'u1'),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe('addBookToCollection', () => {
		const userId = 'u1';
		const collId = 'c1';

		it('should add new books to collection', async () => {
			mockUserRepo.findOne.mockResolvedValue({ id: userId } as any);
			mockCollectionRepo.findOne.mockResolvedValue({
				id: collId,
				books: [{ id: 'b1' }],
			} as any);
			mockBookRepo.find.mockResolvedValue([
				{ id: 'b1' },
				{ id: 'b2' },
			] as any);
			mockCollectionRepo.save.mockImplementation(async (c) => c);

			const result = await service.addBookToCollection(
				{ idsBook: ['b1', 'b2'] },
				collId,
				userId,
			);

			expect(result.addedCount).toBe(1);
			expect(result.skippedCount).toBe(1);
			expect(result.books).toHaveLength(2);
		});

		it('should throw NotFoundException if some books are not found', async () => {
			mockUserRepo.findOne.mockResolvedValue({ id: userId } as any);
			mockCollectionRepo.findOne.mockResolvedValue({
				id: collId,
				books: [],
			} as any);
			mockBookRepo.find.mockResolvedValue([{ id: 'b1' }] as any);

			await expect(
				service.addBookToCollection(
					{ idsBook: ['b1', 'invalid'] },
					collId,
					userId,
				),
			).rejects.toThrow(NotFoundException);
		});

		it('should throw BadRequestException if all books are already in collection', async () => {
			mockUserRepo.findOne.mockResolvedValue({ id: userId } as any);
			mockCollectionRepo.findOne.mockResolvedValue({
				id: collId,
				books: [{ id: 'b1' }],
			} as any);
			mockBookRepo.find.mockResolvedValue([{ id: 'b1' }] as any);

			await expect(
				service.addBookToCollection(
					{ idsBook: ['b1'] },
					collId,
					userId,
				),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe('removeBookFromCollection', () => {
		it('should remove book from collection', async () => {
			const userId = 'u1';
			const collId = 'c1';
			mockUserRepo.findOne.mockResolvedValue({ id: userId } as any);
			mockCollectionRepo.findOne.mockResolvedValue({
				id: collId,
				books: [{ id: 'b1' }, { id: 'b2' }],
			} as any);
			mockCollectionRepo.save.mockImplementation(async (c) => c);

			const result = await service.removeBookFromCollection(
				collId,
				'b1',
				userId,
			);

			expect(result.books).toHaveLength(1);
			expect(result.books[0].id).toBe('b2');
		});

		it('should throw NotFoundException if book not in collection', async () => {
			mockUserRepo.findOne.mockResolvedValue({ id: 'u1' } as any);
			mockCollectionRepo.findOne.mockResolvedValue({
				id: 'c1',
				books: [],
			} as any);

			await expect(
				service.removeBookFromCollection('c1', 'b1', 'u1'),
			).rejects.toThrow(NotFoundException);
		});
	});
});
