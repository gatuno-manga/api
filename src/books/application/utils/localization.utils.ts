/**
 * Interface genérica para campos que podem ser localizados.
 */
export interface ILocalizable {
	languageCode?: string | null;
	rank?: number;
}

/**
 * Verifica se a string contém caracteres do leste asiático (Kanji, Hiragana, Katakana, Hangul, etc)
 */
export function hasCJKCharacters(str: string): boolean {
	return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/.test(str);
}

/**
 * Motor de resolução de conteúdo localizado com heurísticas para alfabeto.
 * Segue a hierarquia de prioridades adaptada para usuários ocidentais/orientais:
 * 1. Idioma alvo solicitado (targetLang)
 * 2. Idioma padrão do sistema (defaultLang)
 * 3. Idioma ponte global (inglês), caso ocidental
 * 4. Idioma original da obra (originalLang) - priorizando versão romanizada se usuário ocidental
 * 5. Qualquer conteúdo sem caracteres CJK (se usuário ocidental)
 * 6. Qualquer conteúdo disponível
 *
 * Em caso de múltiplos resultados para o mesmo idioma, o maior rank vence.
 */
export function resolveLocalizedField<T extends ILocalizable>(
	items: T[] | undefined | null,
	targetLang: string | undefined | null,
	originalLang: string | undefined | null,
	defaultLang = 'pt-BR',
	textExtractor?: (item: T) => string | undefined | null,
): T | null {
	if (!items || items.length === 0) return null;

	const getMatchesForLang = (lang: string) => {
		return items.filter(
			(item) => item.languageCode?.toLowerCase() === lang.toLowerCase(),
		);
	};

	const getHighestRank = (list: T[]) =>
		list.sort((a, b) => (b.rank || 0) - (a.rank || 0))[0];

	const isTargetCJK = targetLang
		? ['ja', 'zh', 'ko'].some((code) =>
				targetLang.toLowerCase().startsWith(code),
			)
		: false;
	const preferLatinFallback = !isTargetCJK;

	// Helper: filtra apenas os que NÃO tem CJK
	const getNonCJK = (list: T[]) => {
		if (!textExtractor) return list;
		return list.filter((m) => {
			const text = textExtractor(m);
			return text ? !hasCJKCharacters(text) : false;
		});
	};

	// 1. Tentar idioma solicitado explicitamente
	if (targetLang) {
		const matches = getMatchesForLang(targetLang);
		if (matches.length > 0) {
			if (preferLatinFallback) {
				const nonCJK = getNonCJK(matches);
				if (nonCJK.length > 0) return getHighestRank(nonCJK);
			}
			return getHighestRank(matches);
		}
	}

	// 2. Tentar idioma padrão do sistema
	if (defaultLang) {
		const matches = getMatchesForLang(defaultLang);
		if (matches.length > 0) {
			if (preferLatinFallback) {
				const nonCJK = getNonCJK(matches);
				if (nonCJK.length > 0) return getHighestRank(nonCJK);
			}
			return getHighestRank(matches);
		}
	}

	// 3. Tentar idioma inglês como ponte global caso o usuário seja ocidental e não haja no idioma dele
	if (preferLatinFallback) {
		const matches = getMatchesForLang('en');
		if (matches.length > 0) {
			const nonCJK = getNonCJK(matches);
			if (nonCJK.length > 0) return getHighestRank(nonCJK);
			return getHighestRank(matches);
		}
	}

	// 4. Se for ocidental, procurar QUALQUER título romanizado/latino do idioma original
	if (preferLatinFallback && originalLang) {
		const matches = getMatchesForLang(originalLang);
		if (matches.length > 0) {
			const nonCJK = getNonCJK(matches);
			if (nonCJK.length > 0) return getHighestRank(nonCJK);
		}
	}

	// 5. Se for ocidental, procurar QUALQUER título latino em TODA A LISTA
	if (preferLatinFallback) {
		const nonCJKAll = getNonCJK(items);
		if (nonCJKAll.length > 0) return getHighestRank(nonCJKAll);
	}

	// 6. Fallback final: Tentar o idioma original mesmo que seja CJK
	if (originalLang) {
		const matches = getMatchesForLang(originalLang);
		if (matches.length > 0) return getHighestRank(matches);
	}

	// 7. Qualquer coisa que sobrou (Absoluto)
	return getHighestRank([...items]);
}
