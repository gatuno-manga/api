import { Book as DomainBook } from '@books/domain/entities/book';
import { BookOrderField } from '@books/domain/enums/book-order-field.enum';
import { Book as InfrastructureBook } from '@books/infrastructure/database/entities/book.entity';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
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
		getRawAndEntities: jest.fn(),
		addSelect: jest.fn().mockReturnThis(),
		withDeleted: jest.fn().mockReturnThis(),
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

		it('should include books soft-deleted after the page query, so their classification is never reported as empty', async () => {
			// Arrange
			const books = [{ id: '1' }] as DomainBook[];
			mockQueryBuilder.getMany.mockResolvedValue([]);

			// Act
			await adapter.loadListRelations(books);

			// Assert
			expect(mockQueryBuilder.withDeleted).toHaveBeenCalledTimes(3);
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
				.mockResolvedValueOnce([
					{ id: '1', tags: [tag] },
					{ id: '2', tags: [] },
				])
				.mockResolvedValueOnce([
					{ id: '1', authors: [author] },
					{ id: '2', authors: [] },
				])
				.mockResolvedValueOnce([
					{ id: '1', sensitiveContent: [sensitiveContent] },
					{ id: '2', sensitiveContent: [] },
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

		it('should break ties by id so equal sort values never swap between two pages', async () => {
			// Arrange
			const options = {
				page: 1,
				limit: 10,
				orderBy: BookOrderField.TITLE,
				order: OrderDirection.ASC,
			} as any;
			mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

			// Act
			await adapter.findWithFilters(
				options,
				{ effectiveMaxWeightSensitiveContent: 0 },
				[],
			);

			// Assert
			expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
				'book.title',
				'ASC',
			);
			expect(mockQueryBuilder.addOrderBy.mock.calls).toEqual([
				['book.createdAt', 'DESC'],
				['book.id', 'DESC'],
			]);
		});
	});

	describe('findWithFiltersAfter', () => {
		const accessContext = { effectiveMaxWeightSensitiveContent: 0 };
		const position = {
			sortValue: 'Solo Leveling',
			createdAt: '2026-01-01 10:00:00.123456',
			id: '0190a2b4-0000-7000-8000-000000000001',
		};
		const keysetCondition = () =>
			mockQueryBuilder.andWhere.mock.calls
				.map(([condition]) => condition)
				.find(
					(condition) =>
						typeof condition === 'string' &&
						condition.includes(':cursorKey'),
				);

		beforeEach(() => {
			mockQueryBuilder.getRawAndEntities.mockResolvedValue({
				entities: [],
				raw: [],
			});
		});

		it('should start at the top of the list without a position', async () => {
			// Act
			await adapter.findWithFiltersAfter(
				{ orderBy: BookOrderField.TITLE } as any,
				accessContext,
				[],
				null,
				6,
			);

			// Assert
			expect(keysetCondition()).toBeUndefined();
			expect(mockQueryBuilder.take).toHaveBeenCalledWith(6);
		});

		it('should return each book with its database timestamps, so rows within one millisecond are not skipped', async () => {
			// Arrange
			mockQueryBuilder.getRawAndEntities.mockResolvedValue({
				entities: [{ id: position.id, title: 'Solo Leveling' }],
				raw: [
					{
						book_id: position.id,
						cursor_created_at: '2026-01-01 10:00:00.123456',
						cursor_updated_at: '2026-02-01 08:00:00.654321',
					},
				],
			});

			// Act
			const [titleSorted] = await adapter.findWithFiltersAfter(
				{ orderBy: BookOrderField.TITLE } as any,
				accessContext,
				[],
				null,
				6,
			);
			const [updatedSorted] = await adapter.findWithFiltersAfter(
				{ orderBy: BookOrderField.UPDATED_AT } as any,
				accessContext,
				[],
				null,
				6,
			);

			// Assert
			expect(titleSorted.position).toEqual(position);
			expect(updatedSorted.position.sortValue).toBe(
				'2026-02-01 08:00:00.654321',
			);
		});

		it('should return nothing when the access policy blocks every book', async () => {
			// Act
			const result = await adapter.findWithFiltersAfter(
				{} as any,
				{ blockedAll: true, effectiveMaxWeightSensitiveContent: 0 },
				[],
				position,
				6,
			);

			// Assert
			expect(result).toEqual([]);
			expect(mockQueryBuilder.getRawAndEntities).not.toHaveBeenCalled();
		});

		it('should continue strictly after the position in title, then createdAt DESC, then id DESC order', async () => {
			// Act
			await adapter.findWithFiltersAfter(
				{
					orderBy: BookOrderField.TITLE,
					order: OrderDirection.ASC,
				} as any,
				accessContext,
				[],
				position,
				6,
			);

			// Assert
			expect(keysetCondition()).toBe(
				'(book.title > :cursorKey0 OR (book.title = :cursorKey0 AND (book.createdAt < :cursorKey1 OR (book.createdAt = :cursorKey1 AND (book.id < :cursorKey2)))))',
			);
			expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith(
				'cursorKey0',
				'Solo Leveling',
			);
			expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith(
				'cursorKey1',
				position.createdAt,
			);
			expect(mockQueryBuilder.setParameter).toHaveBeenCalledWith(
				'cursorKey2',
				position.id,
			);
		});

		it('should not repeat createdAt as a tiebreaker when it is already the sort field', async () => {
			// Act
			await adapter.findWithFiltersAfter(
				{} as any,
				accessContext,
				[],
				{ ...position, sortValue: position.createdAt },
				6,
			);

			// Assert
			expect(keysetCondition()).toBe(
				'(book.createdAt < :cursorKey0 OR (book.createdAt = :cursorKey0 AND (book.id < :cursorKey1)))',
			);
		});

		it.each([
			[
				'DESC from a year: smaller years, then the NULLs MySQL puts last',
				OrderDirection.DESC,
				1997,
				'(book.publication < :cursorKey0 OR book.publication IS NULL) OR (book.publication = :cursorKey0 AND',
			],
			[
				'DESC from NULL: only other NULL rows, since NULLs are last',
				OrderDirection.DESC,
				null,
				'(1 = 0 OR (book.publication IS NULL AND',
			],
			[
				'ASC from NULL: every year, since NULLs are first',
				OrderDirection.ASC,
				null,
				'(book.publication IS NOT NULL OR (book.publication IS NULL AND',
			],
			[
				'ASC from a year: only larger years',
				OrderDirection.ASC,
				1997,
				'(book.publication > :cursorKey0 OR (book.publication = :cursorKey0 AND',
			],
		])(
			'should place publication %s',
			async (_case, order, sortValue, expectedStart) => {
				// Act
				await adapter.findWithFiltersAfter(
					{ orderBy: BookOrderField.PUBLICATION, order } as any,
					accessContext,
					[],
					{ ...position, sortValue },
					6,
				);

				// Assert
				expect(keysetCondition()).toContain(expectedStart);
			},
		);
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
