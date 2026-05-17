import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { FilterOperator } from 'src/common/enum/filter-operator.enum';
import { SelectQueryBuilder } from 'typeorm';
import { FilterStrategy } from './filter-strategy.interface';

export class PublicationFilterStrategy implements FilterStrategy {
	canApply(options: BookPageOptionsDto): boolean {
		return !!options.publication;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const operator = options.publicationOperator || FilterOperator.EQ;
		const publication = options.publication ?? 0;

		switch (operator) {
			case FilterOperator.EQ:
				queryBuilder.andWhere('book.publication = :publication', {
					publication,
				});
				break;
			case FilterOperator.GT:
				queryBuilder.andWhere('book.publication > :publication', {
					publication,
				});
				break;
			case FilterOperator.LT:
				queryBuilder.andWhere('book.publication < :publication', {
					publication,
				});
				break;
			case FilterOperator.GTE:
				queryBuilder.andWhere('book.publication >= :publication', {
					publication,
				});
				break;
			case FilterOperator.LTE:
				queryBuilder.andWhere('book.publication <= :publication', {
					publication,
				});
				break;
		}
	}
}
