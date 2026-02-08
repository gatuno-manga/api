import { SelectQueryBuilder } from 'typeorm';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../entitys/book.entity';
import { BaseManyToManyFilterStrategy } from './base-many-to-many-filter.strategy';

export class TagsFilterStrategy extends BaseManyToManyFilterStrategy {
	constructor() {
		super('books_tags_tags', 'tagsId');
	}

	canApply(options: BookPageOptionsDto): boolean {
		return !!options.tags && options.tags.length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const logic = options.tagsLogic || 'and';
		const tags = options.tags ?? [];
		this.applyLogic(queryBuilder, tags, logic, false);
	}
}
