import { SelectQueryBuilder } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { BaseManyToManyFilterStrategy } from './base-many-to-many-filter.strategy';

export class ExcludeTagsFilterStrategy extends BaseManyToManyFilterStrategy {
	constructor() {
		super('books_tags_tags', 'tagsId');
	}

	canApply(options: BookPageOptionsDto): boolean {
		return !!options.excludeTags && options.excludeTags.length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const logic = options.excludeTagsLogic || 'or';
		this.applyLogic(queryBuilder, options.excludeTags!, logic, true);
	}
}
