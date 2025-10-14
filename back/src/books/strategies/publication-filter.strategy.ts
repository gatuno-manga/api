import { SelectQueryBuilder } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { FilterStrategy } from './filter-strategy.interface';

export class PublicationFilterStrategy implements FilterStrategy {
    canApply(options: BookPageOptionsDto): boolean {
        return !!options.publication;
    }

    apply(
        queryBuilder: SelectQueryBuilder<Book>,
        options: BookPageOptionsDto,
    ): void {
        const operator = options.publicationOperator || 'eq';
        const publication = options.publication!;

        switch (operator) {
            case 'eq':
                queryBuilder.andWhere('book.publication = :publication', {
                    publication,
                });
                break;
            case 'gt':
                queryBuilder.andWhere('book.publication > :publication', {
                    publication,
                });
                break;
            case 'lt':
                queryBuilder.andWhere('book.publication < :publication', {
                    publication,
                });
                break;
            case 'gte':
                queryBuilder.andWhere('book.publication >= :publication', {
                    publication,
                });
                break;
            case 'lte':
                queryBuilder.andWhere('book.publication <= :publication', {
                    publication,
                });
                break;
        }
    }
}
