import { Meilisearch } from 'meilisearch';
import { SelectQueryBuilder } from 'typeorm';
import { Logger } from '@nestjs/common';
import {
	FULLTEXT_COLUMNS,
	FULLTEXT_SPECIAL_CHARS_REGEX,
	LIKE_FALLBACK_COLUMNS,
} from '@books/domain/constants/search.constants';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { FilterStrategy } from './filter-strategy.interface';

export class SearchFilterStrategy implements FilterStrategy {
	private readonly logger = new Logger(SearchFilterStrategy.name);

	constructor(private readonly meiliClient?: Meilisearch) {}

	canApply(options: BookPageOptionsDto): boolean {
		const terms = this.normalizeTerms(options.search ?? '');
		const hasSearch = terms.length > 0;
		const hasSites = !!(options.sites && options.sites.length > 0);
		return hasSearch || hasSites;
	}

	async apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): Promise<void> {
		if (this.meiliClient) {
			try {
				const filter: string[] = [];

				if (options.sites && options.sites.length > 0) {
					const sitesFilter = options.sites
						.map((site) => `sites = "${site}"`)
						.join(' OR ');
					filter.push(`(${sitesFilter})`);
				}

				const meiliFilter =
					filter.length > 0 ? filter.join(' AND ') : undefined;
				const query = options.search || '';

				const searchResult = await this.meiliClient
					.index('books')
					.search(query, {
						limit: 100,
						filter: meiliFilter,
						attributesToRetrieve: ['id'],
					});

				const ids = searchResult.hits.map((hit) => hit.id as string);

				if (ids.length > 0) {
					queryBuilder.andWhere('book.id IN (:...ids)', { ids });
					const escapedIds = ids.map((id) => `'${id}'`).join(',');
					queryBuilder.addOrderBy(`FIELD(book.id, ${escapedIds})`);
					return;
				}

				// Se o Meilisearch não retornou nada, forçamos resultado vazio
				queryBuilder.andWhere('1 = 0');
				return;
			} catch (error) {
				this.logger.error(`Meilisearch search error: ${error.message}`);
			}
		}

		// Fallback Logic (Existing MySQL Fulltext Search)
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
