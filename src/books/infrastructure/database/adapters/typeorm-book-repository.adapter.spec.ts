import { Book as DomainBook } from '@books/domain/entities/book';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmBookRepositoryAdapter } from './typeorm-book-repository.adapter';

describe('TypeOrmBookRepositoryAdapter', () => {
	let adapter: TypeOrmBookRepositoryAdapter;
	let _repository: jest.Mocked<Repository<InfrastructureBook>>;

	const mockQueryBuilder = {
		leftJoinAndSelect: jest.fn().mockReturnThis(),
		loadRelationCountAndMap: jest.fn().mockReturnThis(),
		where: jest.fn().mockReturnThis(),
		andWhere: jest.fn().mockReturnThis(),
		orWhere: jest.fn().mockReturnThis(),
		orderBy: jest.fn().mockReturnThis(),
		addOrderBy: jest.fn().mockReturnThis(),
		skip: jest.fn().mockReturnThis(),
		take: jest.fn().mockReturnThis(),
		getOne: jest.fn(),
		getManyAndCount: jest.fn(),
		getMany: jest.fn(),
		getSql: jest.fn().mockReturnValue('SELECT * FROM book'),
		subQuery: jest.fn().mockReturnThis(),
		select: jest.fn().mockReturnThis(),
		from: jest.fn().mockReturnThis(),
		innerJoin: jest.fn().mockReturnThis(),
		setParameter: jest.fn().mockReturnThis(),
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
		_repository = module.get(getRepositoryToken(InfrastructureBook));
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

		it('should manually populate alternative_titles_text before saving', async () => {
			const domainBook = {
				title: 'New Book',
				alternativeTitles: [
					{ title: 'Alternative 1' },
					{ title: 'Alternative 2' },
				],
				searchTerms: ['term1', 'term2'],
			} as unknown as DomainBook;

			const savedInfraBook = {
				...domainBook,
				id: '1',
			} as unknown as InfrastructureBook;
			mockRepository.save.mockResolvedValue(savedInfraBook);

			await adapter.save(domainBook);

			expect(mockRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					alternative_titles_text:
						'New Book, Alternative 1, Alternative 2, term1, term2',
				}),
			);
		});
	});

	describe('findByIdWithDetails', () => {
		it('should return book with all details', async () => {
			const book = { id: '1', title: 'Book 1' } as InfrastructureBook;
			mockQueryBuilder.getOne.mockResolvedValue(book);

			const result = await adapter.findByIdWithDetails('1');

			expect(result).toEqual(book);
			expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalled();
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'book.id = :id',
				{
					id: '1',
				},
			);
		});
	});

	describe('loadListRelations', () => {
		it('should not query the database when there are no books', async () => {
			// Arrange
			const books: DomainBook[] = [];

			// Act
			const result = await adapter.loadListRelations(books);

			// Assert
			expect(result).toEqual([]);
			expect(mockQueryBuilder.getMany).not.toHaveBeenCalled();
		});

		it('should load each relation in its own query so list rows do not multiply per book', async () => {
			// Arrange
			const books = [{ id: '1' }, { id: '2' }] as DomainBook[];
			mockQueryBuilder.getMany.mockResolvedValue([]);

			// Act
			await adapter.loadListRelations(books);

			// Assert
			expect(mockQueryBuilder.leftJoinAndSelect.mock.calls).toEqual([
				['book.tags', 'tags'],
				['book.authors', 'authors'],
				['book.sensitiveContent', 'sensitiveContent'],
			]);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'book.id IN (:...ids)',
				{ ids: ['1', '2'] },
			);
		});

		it('should attach the relations to each book and use [] when a book has none, so clients can tell "none" from "unknown"', async () => {
			// Arrange
			const books = [
				{ id: '1', title: 'Tagged' },
				{ id: '2', title: 'Bare' },
			] as DomainBook[];
			const tag = { id: 't1', name: 'Action' };
			const author = { id: 'a1', name: 'Author' };
			const sensitiveContent = { id: 's1', name: 'Gore', weight: 3 };
			mockQueryBuilder.getMany
				.mockResolvedValueOnce([{ id: '1', tags: [tag] }])
				.mockResolvedValueOnce([{ id: '1', authors: [author] }])
				.mockResolvedValueOnce([
					{ id: '1', sensitiveContent: [sensitiveContent] },
				]);

			// Act
			const result = await adapter.loadListRelations(books);

			// Assert
			expect(result).toEqual([
				{
					id: '1',
					title: 'Tagged',
					tags: [tag],
					authors: [author],
					sensitiveContent: [sensitiveContent],
				},
				{
					id: '2',
					title: 'Bare',
					tags: [],
					authors: [],
					sensitiveContent: [],
				},
			]);
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
		});

		it('should apply the effective max weight filter in the database query', async () => {
			const options = { page: 1, limit: 10 } as any;
			const accessContext = {
				blockedAll: false,
				effectiveMaxWeightSensitiveContent: 10,
			} as any;

			mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

			await adapter.findWithFilters(options, accessContext, []);

			expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith(
				'maxWeight',
				10,
			);
		});
	});

	describe('findRandom', () => {
		it('should return a random book', async () => {
			const book = {
				id: '1',
				title: 'Random Book',
			} as InfrastructureBook;
			mockQueryBuilder.getOne.mockResolvedValue(book);

			const accessContext = {
				blockedAll: false,
				effectiveMaxWeightSensitiveContent: 100,
			} as any;

			const result = await adapter.findRandom(
				{ limit: 1 } as any,
				accessContext,
				[],
			);

			expect(result).toEqual(book);
			expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('RAND()');
		});
	});
	describe('findBooksWithCoverIssues', () => {
		it('should return books with missing or failed covers', async () => {
			const books = [
				{ id: '1', title: 'Book 1' },
			] as InfrastructureBook[];
			const total = 1;
			mockQueryBuilder.getManyAndCount.mockResolvedValue([books, total]);

			const [resultBooks, resultTotal] =
				await adapter.findBooksWithCoverIssues(1, 10);

			expect(resultBooks).toEqual(books);
			expect(resultTotal).toBe(total);
			expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
				'book.covers',
				'covers',
			);
			expect(mockQueryBuilder.where).toHaveBeenCalledWith(
				'covers.id IS NULL',
			);
			expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
				'covers.scrapingStatus = :status',
				{ status: 'error' },
			);
			expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
			expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
		});
	});
});
