import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Meilisearch } from 'meilisearch';
import { SelectQueryBuilder } from 'typeorm';
import { SearchFilterStrategy } from './search-filter.strategy';

describe('SearchFilterStrategy', () => {
	let strategy: SearchFilterStrategy;
	let queryBuilder: jest.Mocked<SelectQueryBuilder<Book>>;

	beforeEach(() => {
		strategy = new SearchFilterStrategy();

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

		it('should return false when search is not provided', () => {
			const options = new BookPageOptionsDto();
			expect(strategy.canApply(options)).toBe(false);
		});
	});

	describe('apply', () => {
		it('should apply MySQL Fulltext search with soundex for short queries', async () => {
			const options = new BookPageOptionsDto();
			options.search = 'Ranker Solo';

			await strategy.apply(queryBuilder, options);

			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('MATCH'),
				expect.objectContaining({
					booleanQuery: '+Ranker* +Solo*',
					soundex_0: 'Ranker',
					soundex_1: 'Solo',
				}),
			);
			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('SOUNDS LIKE'),
				expect.any(Object),
			);
		});

		it('should NOT apply soundex for long queries (> 3 words)', async () => {
			const options = new BookPageOptionsDto();
			options.search = 'A long search query with many words';

			await strategy.apply(queryBuilder, options);

			expect(queryBuilder.andWhere).toHaveBeenCalledWith(
				expect.stringContaining('MATCH'),
				expect.any(Object),
			);
			expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
				expect.stringContaining('SOUNDS LIKE'),
				expect.any(Object),
			);
		});
	});
});
