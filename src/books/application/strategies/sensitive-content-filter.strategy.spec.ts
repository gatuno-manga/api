import { Brackets, SelectQueryBuilder } from 'typeorm';
import { SensitiveContentFilterStrategy } from './sensitive-content-filter.strategy';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../../infrastructure/database/entities/book.entity';

describe('SensitiveContentFilterStrategy', () => {
	let strategy: SensitiveContentFilterStrategy;
	let queryBuilder: jest.Mocked<SelectQueryBuilder<Book>>;

	beforeEach(() => {
		strategy = new SensitiveContentFilterStrategy();
		queryBuilder = {
			andWhere: jest.fn().mockImplementation((condition) => {
				if (condition instanceof Brackets) {
					condition.whereFactory(queryBuilder as any);
				}
				return queryBuilder;
			}),
			where: jest.fn().mockReturnThis(),
			orWhere: jest.fn().mockReturnThis(),
			setParameter: jest.fn().mockReturnThis(),
			subQuery: jest.fn().mockReturnValue({
				select: jest.fn().mockReturnThis(),
				from: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				innerJoin: jest.fn().mockReturnThis(),
				getQuery: jest.fn().mockReturnValue('(subquery)'),
			}),
		} as any;
	});

	it('should apply filter when sensitiveContent is provided', () => {
		const options = new BookPageOptionsDto();
		options.sensitiveContent = ['violence'];
		expect(strategy.canApply(options)).toBe(true);
	});

	it('should not apply filter when sensitiveContent is empty', () => {
		const options = new BookPageOptionsDto();
		options.sensitiveContent = [];
		expect(strategy.canApply(options)).toBe(false);
	});

	it('should handle "safe" filter by checking for NOT EXISTS', () => {
		const options = new BookPageOptionsDto();
		options.sensitiveContent = ['safe'];

		strategy.apply(queryBuilder, options);

		expect(queryBuilder.andWhere).toHaveBeenCalledWith(
			expect.any(Brackets),
		);
		expect(queryBuilder.where).toHaveBeenCalledWith(
			expect.stringContaining('NOT EXISTS'),
		);
		expect(queryBuilder.subQuery).toHaveBeenCalled();
	});

	it('should handle "0" filter as safe', () => {
		const options = new BookPageOptionsDto();
		options.sensitiveContent = ['0'];

		strategy.apply(queryBuilder, options);

		expect(queryBuilder.andWhere).toHaveBeenCalledWith(
			expect.any(Brackets),
		);
		expect(queryBuilder.where).toHaveBeenCalledWith(
			expect.stringContaining('NOT EXISTS'),
		);
		expect(queryBuilder.subQuery).toHaveBeenCalled();
	});

	it('should handle both safe and real tags', () => {
		const options = new BookPageOptionsDto();
		options.sensitiveContent = ['safe', 'violence'];

		strategy.apply(queryBuilder, options);

		expect(queryBuilder.andWhere).toHaveBeenCalledWith(
			expect.any(Brackets),
		);
		expect(queryBuilder.where).toHaveBeenCalledWith(
			expect.stringContaining('EXISTS'),
		);
		expect(queryBuilder.orWhere).toHaveBeenCalledWith(
			expect.stringContaining('NOT EXISTS'),
		);
		expect(queryBuilder.subQuery).toHaveBeenCalledTimes(2);
	});
});
