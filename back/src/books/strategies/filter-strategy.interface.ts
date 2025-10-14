import { SelectQueryBuilder } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookPageOptionsDto } from '../dto/book-page-options.dto';

/**
 * Interface base para estratégias de filtro de livros.
 * Implementa o padrão Strategy para aplicar diferentes tipos de filtros
 * à query de busca de livros de forma modular e extensível.
 */
export interface FilterStrategy {
    /**
     * Aplica o filtro específico ao QueryBuilder.
     * @param queryBuilder - QueryBuilder do TypeORM para construir a query
     * @param options - Opções de filtro e paginação fornecidas pelo usuário
     */
    apply(
        queryBuilder: SelectQueryBuilder<Book>,
        options: BookPageOptionsDto,
    ): void | Promise<void>;

    /**
     * Verifica se este filtro deve ser aplicado baseado nas opções fornecidas.
     * @param options - Opções de filtro e paginação fornecidas pelo usuário
     * @returns true se o filtro deve ser aplicado, false caso contrário
     */
    canApply(options: BookPageOptionsDto): boolean;
}
