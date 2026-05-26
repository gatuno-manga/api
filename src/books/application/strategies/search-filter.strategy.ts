import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import {
	FULLTEXT_COLUMNS,
	FULLTEXT_SPECIAL_CHARS_REGEX,
	LIKE_FALLBACK_COLUMNS,
} from '@books/domain/constants/search.constants';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { Logger } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { FilterStrategy } from './filter-strategy.interface';

export class SearchFilterStrategy implements FilterStrategy {
	private readonly logger = new Logger(SearchFilterStrategy.name);

	canApply(options: BookPageOptionsDto): boolean {
		const terms = this.normalizeTerms(options.search ?? '');
		return terms.length > 0;
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const terms = this.normalizeTerms(options.search ?? '');
		if (terms.length === 0) return;

		const booleanQuery = this.buildBooleanQuery(terms);
		const likeSearch = `%${(options.search ?? '').trim()}%`;

		const params: Record<string, string | number> = {
			booleanQuery,
			likeSearch,
		};

		// 1. Cláusula FULLTEXT (Principal)
		const fulltextClause = `MATCH(${FULLTEXT_COLUMNS}) AGAINST(:booleanQuery IN BOOLEAN MODE)`;

		// 2. Cláusula SOUNDS LIKE (Apenas para termos curtos para evitar lentidão)
		const soundexClauses: string[] = [];
		if (terms.length > 0 && terms.length <= 3) {
			for (let i = 0; i < terms.length; i++) {
				params[`soundex_${i}`] = terms[i];
				soundexClauses.push(`book.title SOUNDS LIKE :soundex_${i}`);
			}
		}

		// 3. Cláusula LIKE (Fallback para campos JSON não indexados em FT)
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
