import { SelectQueryBuilder } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { BaseManyToManyFilterStrategy } from './base-many-to-many-filter.strategy';

export class AuthorsFilterStrategy extends BaseManyToManyFilterStrategy {
    constructor() {
        super('books_authors_authors', 'authorsId');
    }

    canApply(options: BookPageOptionsDto): boolean {
        return !!options.authors && options.authors.length > 0;
    }

    apply(
        queryBuilder: SelectQueryBuilder<Book>,
        options: BookPageOptionsDto,
    ): void {
        const logic = options.authorsLogic || 'and';
        this.applyLogic(queryBuilder, options.authors!, logic, false);
    }
}
