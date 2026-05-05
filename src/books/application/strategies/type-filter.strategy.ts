import { SelectQueryBuilder } from 'typeorm';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { FilterStrategy } from './filter-strategy.interface';

export class TypeFilterStrategy implements FilterStrategy {
	canApply(options: BookPageOptionsDto): boolean {
		return !!options.type && options.type.length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		queryBuilder.andWhere('book.type IN (:...types)', {
			types: options.type,
		});
	}
}
