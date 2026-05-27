/**
 * Interface genérica para campos que podem ser localizados.
 */
export interface ILocalizable {
	languageCode?: string | null;
	rank?: number;
}

/**
 * Motor de resolução de conteúdo localizado.
 * Segue a hierarquia de prioridades:
 * 1. Idioma alvo solicitado (targetLang)
 * 2. Idioma original da obra (originalLang)
 * 3. Idioma padrão do sistema (defaultLang)
 * 4. Qualquer conteúdo disponível
 *
 * Em caso de múltiplos resultados para o mesmo idioma, o maior rank vence.
 */
export function resolveLocalizedField<T extends ILocalizable>(
	items: T[] | undefined | null,
	targetLang: string | undefined | null,
	originalLang: string | undefined | null,
	defaultLang = 'pt-BR',
): T | null {
	if (!items || items.length === 0) return null;

	// Helper para filtrar e ordenar por rank (DESC)
	const getBestMatch = (lang: string | undefined | null) => {
		if (!lang) return null;
		const matches = items.filter(
			(item) => item.languageCode?.toLowerCase() === lang.toLowerCase(),
		);
		if (matches.length === 0) return null;
		return matches.sort((a, b) => (b.rank || 0) - (a.rank || 0))[0];
	};

	// 1. Tentar idioma solicitado explicitamente
	const targetMatch = getBestMatch(targetLang);
	if (targetMatch) return targetMatch;

	// 2. Tentar idioma original da obra
	const originalMatch = getBestMatch(originalLang);
	if (originalMatch) return originalMatch;

	// 3. Tentar idioma padrão do sistema
	const defaultMatch = getBestMatch(defaultLang);
	if (defaultMatch) return defaultMatch;

	// 4. Fallback absoluto: o item com maior rank independente do idioma
	return items.sort((a, b) => (b.rank || 0) - (a.rank || 0))[0];
}
