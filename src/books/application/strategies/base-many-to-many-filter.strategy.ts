import { SelectQueryBuilder } from 'typeorm';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { FilterStrategy } from './filter-strategy.interface';

/**
 * Classe base abstrata para filtros de relacionamento muitos-para-muitos.
 * Implementa lógica comum para filtros que envolvem tabelas de junção,
 * como tags e autores, suportando operadores lógicos AND/OR.
 */
export abstract class BaseManyToManyFilterStrategy implements FilterStrategy {
	/**
	 * @param table - Nome da tabela de junção (ex: 'books_tags_tags')
	 * @param columnName - Nome da coluna de ID na tabela de junção (ex: 'tagsId')
	 */
	constructor(
		protected readonly table: string,
		protected readonly columnName: string,
	) {}

	abstract canApply(options: BookPageOptionsDto): boolean;
	abstract apply(
		queryBuilder: SelectQueryBuilder<Book>,
		options: BookPageOptionsDto,
	): void;

	/**
	 * Aplica a lógica de filtro AND/OR para relacionamentos muitos-para-muitos.
	 *
	 * @param queryBuilder - QueryBuilder do TypeORM
	 * @param ids - Array de IDs para filtrar
	 * @param logic - Operador lógico: 'and' (todos os IDs devem estar presentes) ou 'or' (qualquer ID)
	 * @param exclude - Se true, inverte a lógica para excluir ao invés de incluir
	 */
	protected applyLogic(
		queryBuilder: SelectQueryBuilder<Book>,
		ids: string[],
		logic: 'and' | 'or',
		exclude = false,
	): void {
		const alias = `${this.table}_filter`;
		const parameterName = `ids_${this.table}_${Math.random().toString(36).substring(7)}`;

		if (logic === 'or') {
			if (exclude) {
				queryBuilder.andWhere((qb) => {
					const subQuery = qb
						.subQuery()
						.select(`${alias}.booksId`)
						.from(this.table, alias)
						.where(
							`${alias}.${this.columnName} IN (:...${parameterName})`,
						);
					return `book.id NOT IN ${subQuery.getQuery()}`;
				});
				queryBuilder.setParameter(parameterName, ids);
			} else {
				queryBuilder
					.innerJoin(this.table, alias, `${alias}.booksId = book.id`)
					.andWhere(
						`${alias}.${this.columnName} IN (:...${parameterName})`,
						{
							[parameterName]: ids,
						},
					);
			}
		} else {
			// Lógica AND: livros que possuem TODOS os IDs fornecidos
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select(`${alias}.booksId`)
					.from(this.table, alias)
					.where(
						`${alias}.${this.columnName} IN (:...${parameterName})`,
					)
					.groupBy(`${alias}.booksId`)
					.having(
						`COUNT(DISTINCT ${alias}.${this.columnName}) = :count`,
						{
							count: ids.length,
						},
					);

				return exclude
					? `book.id NOT IN ${subQuery.getQuery()}`
					: `book.id IN ${subQuery.getQuery()}`;
			});
			queryBuilder.setParameter(parameterName, ids);
		}
	}
}
