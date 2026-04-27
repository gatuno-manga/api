import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmBookRepositoryAdapter } from './typeorm-book-repository.adapter';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Book as DomainBook } from '@books/domain/entities/book';

describe('TypeOrmBookRepositoryAdapter', () => {
	let adapter: TypeOrmBookRepositoryAdapter;
	let repository: jest.Mocked<Repository<InfrastructureBook>>;

	const mockQueryBuilder = {
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		loadRelationCountAndMap: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		addOrderBy: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		take: jest.fn().mockReturnThis(),
		getOne: jest.fn(),
		getManyAndCount: jest.fn(),
		getSql: jest.fn().mockReturnValue('SELECT * FROM book'),
		subQuery: jest.fn().mockReturnThis(),
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		innerJoin: jest.fn().mockReturnThis(),
		getQuery: jest.fn().mockReturnValue('(SELECT 1)'),
	};

	const mockRepository = {
		findOne: jest.fn(),
		save: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		softDelete: jest.fn(),
		exists: jest.fn(),
		count: jest.fn(),
		createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TypeOrmBookRepositoryAdapter,
				{
					provide: getRepositoryToken(InfrastructureBook),
					useValue: mockRepository,
				},
			],
		}).compile();

		adapter = module.get<TypeOrmBookRepositoryAdapter>(
			TypeOrmBookRepositoryAdapter,
		);
		repository = module.get(getRepositoryToken(InfrastructureBook));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(adapter).toBeDefined();
	});

	describe('findById', () => {
		it('should return a book if found', async () => {
			const infraBook = {
				id: '1',
				title: 'Test Book',
			} as InfrastructureBook;
			mockRepository.findOne.mockResolvedValue(infraBook);

			const result = await adapter.findById('1');

			expect(result).toEqual(infraBook);
			expect(mockRepository.findOne).toHaveBeenCalledWith({
				where: { id: '1' },
				relations: undefined,
			});
		});

		it('should return null if not found', async () => {
			mockRepository.findOne.mockResolvedValue(null);

			const result = await adapter.findById('1');

			expect(result).toBeNull();
		});
	});

	describe('save', () => {
		it('should save and return a book', async () => {
			const domainBook = { title: 'New Book' } as DomainBook;
			const savedInfraBook = {
				...domainBook,
				id: '1',
			} as InfrastructureBook;
			mockRepository.save.mockResolvedValue(savedInfraBook);

			const result = await adapter.save(domainBook);

			expect(result).toEqual(savedInfraBook);
			expect(mockRepository.save).toHaveBeenCalledWith(domainBook);
		});
	});

	describe('delete', () => {
		it('should call repository.delete', async () => {
			await adapter.delete('1');
			expect(mockRepository.delete).toHaveBeenCalledWith('1');
		});
	});

	describe('exists', () => {
		it('should return true if book exists', async () => {
			mockRepository.exists.mockResolvedValue(true);
			const result = await adapter.exists('1');
			expect(result).toBe(true);
			expect(mockRepository.exists).toHaveBeenCalledWith({
				where: { id: '1' },
			});
		});
	});

	describe('findByIdWithDetails', () => {
		it('should return book with details', async () => {
			const infraBook = {
				id: '1',
				title: 'Detailed Book',
			} as InfrastructureBook;
			mockQueryBuilder.getOne.mockResolvedValue(infraBook);

			const result = await adapter.findByIdWithDetails('1');

			expect(result).toEqual(infraBook);
			expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith(
				'book',
			);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'book.id = :id',
				{
					id: '1',
				},
			);
		});
	});

	describe('findWithFilters', () => {
		it('should return books and count with default options', async () => {
			const books = [
				{ id: '1', title: 'Book 1' },
			] as InfrastructureBook[];
			const total = 1;
			mockQueryBuilder.getManyAndCount.mockResolvedValue([books, total]);

			const options = { page: 1, limit: 10 } as any;
			const accessContext = {
				blockedAll: false,
				effectiveMaxWeightSensitiveContent: 100,
			} as any;

			const [resultBooks, resultTotal] = await adapter.findWithFilters(
				options,
				accessContext,
				[],
			);

			expect(resultBooks).toEqual(books);
			expect(resultTotal).toBe(total);
			expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
			expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
		});

		it('should return empty if blockedAll is true', async () => {
			const options = { page: 1, limit: 10 } as any;
			const accessContext = { blockedAll: true } as any;

			const [resultBooks, resultTotal] = await adapter.findWithFilters(
				options,
				accessContext,
				[],
			);

			expect(resultBooks).toEqual([]);
			expect(resultTotal).toBe(0);
			expect(mockQueryBuilder.getManyAndCount).not.toHaveBeenCalled();
		});

		it('should apply the effective max weight filter in the database query', async () => {
			mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

			const options = { page: 1, limit: 10 } as any;
			const accessContext = {
				blockedAll: false,
				effectiveMaxWeightSensitiveContent: 5,
				allowSensitiveContentIds: [],
			} as any;

			await adapter.findWithFilters(options, accessContext, []);

			// Verify that the query builder was used to add a condition for maxWeight
			// We check if andWhere was called. The actual implementation uses a subquery for NOT EXISTS
			expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
		});
	});
});
