import { Brackets, SelectQueryBuilder } from 'typeorm';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { FilterStrategy } from './filter-strategy.interface';

export class SensitiveContentFilterStrategy implements FilterStrategy {
	canApply(options: BookPageOptionsDto): boolean {
		return (
			!!options.sensitiveContent && options.sensitiveContent.length > 0
		);
	}

	apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void {
		const sensitiveContent = options.sensitiveContent ?? [];
		if (sensitiveContent.length === 0) return;

		const isUuid = (str: string) =>
			/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
				str,
			);

		// Identificar se o filtro "safe" (sem classificação) foi solicitado
		const safeTriggerValues = ['safe', '0'];
		const isSafeRequested = sensitiveContent.some((val) =>
			safeTriggerValues.includes(val.toLowerCase()),
		);

		// Filtrar as tags reais (removendo os triggers de "safe")
		const realTags = sensitiveContent.filter(
			(val) => !safeTriggerValues.includes(val.toLowerCase()),
		);

		const hasRealTags = realTags.length > 0;
		const hasUuids = realTags.some(isUuid);

		const paramName = `sc_params_${Math.random()
			.toString(36)
			.substring(7)}`;

		queryBuilder.andWhere(
			new Brackets((qb) => {
				let conditionStarted = false;

				// Condição 1: Livros que possuem as tags solicitadas
				if (hasRealTags) {
					const subQuery = queryBuilder
						.subQuery()
						.select('1')
						.from('books_sensitive_content_sensitive_content', 'j');

					if (hasUuids) {
						subQuery
							.where('j.booksId = book.id')
							.andWhere(
								`j.sensitiveContentId IN (:...${paramName})`,
							);
					} else {
						subQuery
							.innerJoin(
								'sensitive_content',
								'sc',
								'sc.id = j.sensitiveContentId',
							)
							.where('j.booksId = book.id')
							.andWhere(`sc.name IN (:...${paramName})`);
					}

					qb.where(`EXISTS ${subQuery.getQuery()}`);
					queryBuilder.setParameter(paramName, realTags);
					conditionStarted = true;
				}

				// Condição 2: Livros "Safe" (sem nenhuma tag de conteúdo sensível)
				if (isSafeRequested) {
					const noTagsSubQuery = queryBuilder
						.subQuery()
						.select('1')
						.from('books_sensitive_content_sensitive_content', 'j2')
						.where('j2.booksId = book.id');

					if (conditionStarted) {
						qb.orWhere(`NOT EXISTS ${noTagsSubQuery.getQuery()}`);
					} else {
						qb.where(`NOT EXISTS ${noTagsSubQuery.getQuery()}`);
					}
				}
			}),
		);
	}
}
