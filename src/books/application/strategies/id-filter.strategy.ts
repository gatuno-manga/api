import { SelectQueryBuilder } from 'typeorm';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { FilterStrategy } from './filter-strategy.interface';

export class IdFilterStrategy implements FilterStrategy {
	canApply(options: BookPageOptionsDto): boolean {
		return !!options.ids && options.ids.length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		queryBuilder.andWhere('book.id IN (:...ids)', {
			ids: options.ids,
		});
	}
}
