import { SelectQueryBuilder } from 'typeorm';
import {
	FULLTEXT_COLUMNS,
	FULLTEXT_SPECIAL_CHARS_REGEX,
	LIKE_FALLBACK_COLUMNS,
} from '../constants/search.constants';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../entities/book.entity';
import { FilterStrategy } from './filter-strategy.interface';

export class SearchFilterStrategy implements FilterStrategy {
	canApply(options: BookPageOptionsDto): boolean {
		return this.normalizeTerms(options.search ?? '').length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const terms = this.normalizeTerms(options.search ?? '');
		const booleanQuery = this.buildBooleanQuery(terms);
		const likeSearch = `%${(options.search ?? '').trim()}%`;

		const params: Record<string, string> = { booleanQuery, likeSearch };
		terms.forEach((term, idx) => {
			params[`soundex_${idx}`] = term;
		});

		const fulltextClause = `MATCH(${FULLTEXT_COLUMNS}) AGAINST(:booleanQuery IN BOOLEAN MODE)`;

		const soundexClauses = terms.map(
			(_, idx) => `book.title SOUNDS LIKE :soundex_${idx}`,
		);

		const likeClauses = LIKE_FALLBACK_COLUMNS.map(
			(col) => `${col} LIKE :likeSearch`,
		);

		const allClauses = [fulltextClause, ...soundexClauses, ...likeClauses];
		queryBuilder.andWhere(`(${allClauses.join(' OR ')})`, params);
	}

	private normalizeTerms(raw: string): string[] {
		return raw
			.replace(FULLTEXT_SPECIAL_CHARS_REGEX, ' ')
			.trim()
			.split(/\s+/)
			.filter(Boolean);
	}

	private buildBooleanQuery(terms: string[]): string {
		return terms.map((term) => `+${term}*`).join(' ');
	}
}
