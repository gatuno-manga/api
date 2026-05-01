import { SelectQueryBuilder } from 'typeorm';
import { SearchFilterStrategy } from './search-filter.strategy';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../../infrastructure/database/entities/book.entity';
import { Meilisearch } from 'meilisearch';

describe('SearchFilterStrategy', () => {
	let strategy: SearchFilterStrategy;
	let meiliClient: jest.Mocked<Meilisearch>;
	let queryBuilder: jest.Mocked<SelectQueryBuilder<Book>>;

	beforeEach(() => {
		meiliClient = {
			index: jest.fn().mockReturnValue({
				search: jest.fn(),
			}),
		} as any;

		strategy = new SearchFilterStrategy(meiliClient);

		queryBuilder = {
			andWhere: jest.fn().mockReturnThis(),
			addOrderBy: jest.fn().mockReturnThis(),
		} as any;
	});

	describe('canApply', () => {
		it('should return true when search term is provided', () => {
			const options = new BookPageOptionsDto();
			options.search = 'Ranker';
			expect(strategy.canApply(options)).toBe(true);
		});

		it('should return true when sites are provided', () => {
			const options = new BookPageOptionsDto();
			options.sites = ['hiper.cool'];
			expect(strategy.canApply(options)).toBe(true);
		});

		it('should return false when neither search nor sites are provided', () => {
			const options = new BookPageOptionsDto();
			expect(strategy.canApply(options)).toBe(false);
		});
	});

	describe('apply', () => {
		it('should use Meilisearch and apply book.id IN filter when results are found', async () => {
			const options = new BookPageOptionsDto();
			options.search = 'Ranker';
			options.sites = ['hiper.cool'];

			const mockHits = [{ id: 'uuid-1' }, { id: 'uuid-2' }];
			(meiliClient.index('books').search as jest.Mock).mockResolvedValue({
				hits: mockHits,
			});

			await strategy.apply(queryBuilder, options);

			expect(meiliClient.index).toHaveBeenCalledWith('books');
			expect(meiliClient.index('books').search).toHaveBeenCalledWith(
				'Ranker',
				expect.objectContaining({
					filter: '(sites = "hiper.cool")',
				}),
			);

			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				'book.id IN (:...ids)',
				{ ids: ['uuid-1', 'uuid-2'] },
			);
			expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
				"FIELD(book.id, 'uuid-1','uuid-2')",
			);
		});

		it('should apply "1=0" when Meilisearch returns no results', async () => {
			const options = new BookPageOptionsDto();
			options.search = 'NonExistent';

			(meiliClient.index('books').search as jest.Mock).mockResolvedValue({
				hits: [],
			});

			await strategy.apply(queryBuilder, options);

			expect(queryBuilder.andWhere).toHaveBeenCalledWith('1 = 0');
		});

		it('should fallback to MySQL Fulltext search if Meilisearch client is not provided', async () => {
			const fallbackStrategy = new SearchFilterStrategy(undefined);
			const options = new BookPageOptionsDto();
			options.search = 'Ranker';

			await fallbackStrategy.apply(queryBuilder, options);

			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('MATCH'),
				expect.any(Object),
			);
		});

		it('should fallback to MySQL if Meilisearch throws an error', async () => {
			const options = new BookPageOptionsDto();
			options.search = 'Ranker';

			(meiliClient.index('books').search as jest.Mock).mockRejectedValue(
				new Error('Connection failed'),
			);

			await strategy.apply(queryBuilder, options);

			// Should have called MySQL fallback after logging error
			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('MATCH'),
				expect.any(Object),
			);
		});
	});
});
