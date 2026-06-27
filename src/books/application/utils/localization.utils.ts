/**
 * Interface genérica para campos que podem ser localizados.
 */
export interface ILocalizable {
	languageCode?: string | null;
	rank?: number;
}

const NON_LATIN_REGEX =
	/[\u0400-\u04FF\u0500-\u052F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0E00-\u0E7F\u0590-\u05FF\u0900-\u097F\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
const NON_LATIN_LANG_PREFIXES = new Set([
	'ja',
	'zh',
	'ko',
	'ru',
	'ar',
	'th',
	'he',
	'hi',
]);

/**
 * Verifica se a string contém caracteres de alfabetos não-latinos
 * (Cirílico, Árabe, Tailandês, Hebraico, Devanágari, CJK, etc)
 */
export function hasNonLatinCharacters(text: string): boolean {
	return NON_LATIN_REGEX.test(text);
}

/**
 * Motor de resolução de conteúdo localizado com heurísticas para alfabeto.
 */
export class LocalizedFieldResolver<T extends ILocalizable> {
	private readonly items: T[];
	private readonly targetLanguage: string | undefined | null;
	private readonly originalLanguage: string | undefined | null;
	private readonly defaultLanguage: string;
	private readonly preferLatinFallback: boolean;
	private readonly textExtractor?: (item: T) => string | undefined | null;

	constructor(
		items: T[] | undefined | null,
		targetLanguage: string | undefined | null,
		originalLanguage: string | undefined | null,
		defaultLanguage = 'pt-BR',
		textExtractor?: (item: T) => string | undefined | null,
	) {
		this.items = items || [];
		this.targetLanguage = targetLanguage;
		this.originalLanguage = originalLanguage;
		this.defaultLanguage = defaultLanguage;
		this.textExtractor = textExtractor;
		this.preferLatinFallback = this.determineIfPrefersLatinFallback();
	}

	public resolve(): T | null {
		if (this.items.length === 0) {
			return null;
		}

		return (
			this.findMatchForLanguage(this.targetLanguage) ||
			this.findMatchForLanguage(this.defaultLanguage) ||
			this.findGlobalBridgeMatch() ||
			this.findOriginalLanguageLatinMatch() ||
			this.findAnyLatinMatch() ||
			this.findOriginalLanguageMatch() ||
			this.getHighestRank(this.items)
		);
	}

	private determineIfPrefersLatinFallback(): boolean {
		if (!this.targetLanguage) {
			return true;
		}

		const normalizedTargetLanguage = this.targetLanguage.toLowerCase();
		const prefix = normalizedTargetLanguage.split('-')[0];

		return !NON_LATIN_LANG_PREFIXES.has(prefix);
	}

	private findMatchForLanguage(
		language: string | undefined | null,
	): T | null {
		if (!language) {
			return null;
		}

		const matches = this.getMatchesForLanguage(language);

		if (matches.length === 0) {
			return null;
		}

		if (this.preferLatinFallback) {
			const latinMatches = this.filterLatinItems(matches);
			if (latinMatches.length > 0) {
				return this.getHighestRank(latinMatches);
			}
		}

		return this.getHighestRank(matches);
	}

	private findGlobalBridgeMatch(): T | null {
		if (!this.preferLatinFallback) {
			return null;
		}

		const matches = this.getMatchesForLanguage('en');

		if (matches.length === 0) {
			return null;
		}

		const latinMatches = this.filterLatinItems(matches);

		if (latinMatches.length > 0) {
			return this.getHighestRank(latinMatches);
		}

		return this.getHighestRank(matches);
	}

	private findOriginalLanguageLatinMatch(): T | null {
		if (!this.preferLatinFallback || !this.originalLanguage) {
			return null;
		}

		const matches = this.getMatchesForLanguage(this.originalLanguage);

		if (matches.length === 0) {
			return null;
		}

		const latinMatches = this.filterLatinItems(matches);

		if (latinMatches.length > 0) {
			return this.getHighestRank(latinMatches);
		}

		return null;
	}

	private findAnyLatinMatch(): T | null {
		if (!this.preferLatinFallback) {
			return null;
		}

		const allLatinItems = this.filterLatinItems(this.items);

		if (allLatinItems.length > 0) {
			return this.getHighestRank(allLatinItems);
		}

		return null;
	}

	private findOriginalLanguageMatch(): T | null {
		if (!this.originalLanguage) {
			return null;
		}

		const matches = this.getMatchesForLanguage(this.originalLanguage);

		if (matches.length > 0) {
			return this.getHighestRank(matches);
		}

		return null;
	}

	private getMatchesForLanguage(language: string): T[] {
		const normalizedLanguage = language.toLowerCase();
		return this.items.filter((item) => {
			if (!item.languageCode) {
				return false;
			}
			return item.languageCode.toLowerCase() === normalizedLanguage;
		});
	}

	private filterLatinItems(list: T[]): T[] {
		if (!this.textExtractor) {
			return list;
		}

		return list.filter((item) => {
			const text = this.textExtractor?.(item);
			if (!text) {
				return false;
			}
			return !hasNonLatinCharacters(text);
		});
	}

	private getHighestRank(list: T[]): T | null {
		if (list.length === 0) {
			return null;
		}

		return list.reduce((highest, current) => {
			const currentRank = current.rank || 0;
			const highestRank = highest.rank || 0;
			return currentRank > highestRank ? current : highest;
		}, list[0]);
	}
}

/**
 * Função de conveniência para manter a compatibilidade com o uso anterior.
 */
export function resolveLocalizedField<T extends ILocalizable>(
	items: T[] | undefined | null,
	targetLanguage: string | undefined | null,
	originalLanguage: string | undefined | null,
	defaultLanguage = 'pt-BR',
	textExtractor?: (item: T) => string | undefined | null,
): T | null {
	const resolver = new LocalizedFieldResolver(
		items,
		targetLanguage,
		originalLanguage,
		defaultLanguage,
		textExtractor,
	);

	return resolver.resolve();
}
