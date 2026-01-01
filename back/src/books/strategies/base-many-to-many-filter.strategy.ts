import { SelectQueryBuilder } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';
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
		exclude: boolean = false,
	): void {
		if (logic === 'or') {
			// Lógica OR: livros que possuem QUALQUER um dos IDs fornecidos
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select(`${this.table}.booksId`)
					.from(this.table, this.table)
					.where(`${this.table}.${this.columnName} IN (:...ids)`, {
						ids,
					})
					.getQuery();
				return exclude
					? `book.id NOT IN ${subQuery}`
					: `book.id IN ${subQuery}`;
			});
		} else {
			// Lógica AND: livros que possuem TODOS os IDs fornecidos
			queryBuilder.andWhere((qb) => {
				const subQuery = qb
					.subQuery()
					.select(`${this.table}.booksId`)
					.from(this.table, this.table)
					.where(`${this.table}.${this.columnName} IN (:...ids)`, {
						ids,
					})
					.groupBy(`${this.table}.booksId`)
					.having(
						`COUNT(DISTINCT ${this.table}.${this.columnName}) = :count`,
						{ count: ids.length },
					)
					.getQuery();
				return exclude
					? `book.id NOT IN ${subQuery}`
					: `book.id IN ${subQuery}`;
			});
		}
	}
}
