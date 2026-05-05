import { SelectQueryBuilder } from 'typeorm';
import { IdFilterStrategy } from './id-filter.strategy';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';

describe('IdFilterStrategy', () => {
	let strategy: IdFilterStrategy;
	let queryBuilder: jest.Mocked<SelectQueryBuilder<Book>>;

	beforeEach(() => {
		strategy = new IdFilterStrategy();
		queryBuilder = {
			andWhere: jest.fn().mockReturnThis(),
		} as any;
	});

	it('should apply filter when ids are provided', () => {
		const options = new BookPageOptionsDto();
		options.ids = ['550e8400-e29b-41d4-a716-446655440000'];
		expect(strategy.canApply(options)).toBe(true);
	});

	it('should not apply filter when ids are empty', () => {
		const options = new BookPageOptionsDto();
		options.ids = [];
		expect(strategy.canApply(options)).toBe(false);
	});

	it('should call andWhere with correct parameters', () => {
		const options = new BookPageOptionsDto();
		const ids = ['id1', 'id2'];
		options.ids = ids;

		strategy.apply(queryBuilder, options);

		expect(queryBuilder.andWhere).toHaveBeenCalledWith(
			'book.id IN (:...ids)',
			{ ids },
		);
	});
});
