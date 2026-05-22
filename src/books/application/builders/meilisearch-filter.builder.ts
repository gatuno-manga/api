import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { AccessContext } from '@books/domain/types/criteria.types';

/**
 * Construtor de filtros para o Meilisearch.
 * Converte as opções de busca e o contexto de acesso em uma string de filtro compatível com o Meilisearch.
 */
export class MeilisearchFilterBuilder {
	/**
	 * Constrói a string de filtro combinando critérios de busca e políticas de segurança.
	 */
	static build(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
	): string {
		const filters: string[] = [];

		// 1. Filtros Básicos (Opções do Usuário)
		if (options.type) {
			filters.push(`type = "${options.type}"`);
		}

		if (options.sites && options.sites.length > 0) {
			const sitesFilter = options.sites
				.map((site) => `sites = "${site}"`)
				.join(' OR ');
			filters.push(`(${sitesFilter})`);
		}

		if (options.tags && options.tags.length > 0) {
			const logic = options.tagsLogic || 'and';
			const tagFilters = options.tags.map((id) => `tagIds = "${id}"`);
			filters.push(
				`(${tagFilters.join(logic === 'and' ? ' AND ' : ' OR ')})`,
			);
		}

		// Filtro de Publicação (Range)
		if (options.publication) {
			// Atualmente o DTO só tem um campo, mas podemos expandir no futuro
			filters.push(`publication = ${options.publication}`);
		}

		// 2. Filtros de Segurança (Contexto de Acesso)
		if (accessContext.blockedAll) {
			return 'id = "__NONE__"';
		}

		// Peso de Conteúdo Sensível
		filters.push(
			`maxSensitiveWeight <= ${accessContext.effectiveMaxWeightSensitiveContent}`,
		);

		// Livros negados
		if (accessContext.denyBookIds?.length) {
			const denyIds = accessContext.denyBookIds.map(
				(id) => `id != "${id}"`,
			);
			filters.push(`(${denyIds.join(' AND ')})`);
		}

		// Tags negadas
		if (accessContext.denyTagIds?.length) {
			const denyTagIds = accessContext.denyTagIds.map(
				(id) => `tagIds != "${id}"`,
			);
			filters.push(`(${denyTagIds.join(' AND ')})`);
		}

		// Conteúdo sensível negado
		if (accessContext.denySensitiveContentIds?.length) {
			const denyScIds = accessContext.denySensitiveContentIds.map(
				(id) => `sensitiveContentIds != "${id}"`,
			);
			filters.push(`(${denyScIds.join(' AND ')})`);
		}

		return filters.filter(Boolean).join(' AND ');
	}
}
