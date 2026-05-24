/**
 * Lista de códigos de idiomas suportados pelo sistema (BCP-47).
 * Focada nos idiomas mais comuns para agregação de conteúdo.
 */
export const SUPPORTED_LANGUAGE_CODES = [
	'pt-BR', // Português (Brasil)
	'pt-PT', // Português (Portugal)
	'en-US', // Inglês (EUA)
	'en-GB', // Inglês (Reino Unido)
	'es-ES', // Espanhol (Espanha)
	'es-419', // Espanhol (América Latina)
	'ja-JP', // Japonês
	'ko-KR', // Coreano
	'zh-CN', // Chinês (Simplificado)
	'zh-TW', // Chinês (Tradicional)
	'fr-FR', // Francês
	'it-IT', // Italiano
	'de-DE', // Alemão
	'ru-RU', // Russo
	'id-ID', // Indonésio
	'th-TH', // Tailandês
	'vi-VN', // Vietnamita
] as const;

/**
 * Interface para representar um idioma com código e nome legível.
 */
export interface ISupportedLanguage {
	code: string;
	name: string;
}

/**
 * Gera a lista de idiomas suportados com nomes traduzidos usando a API nativa Intl.
 * Esta API é parte do motor V8 (Node.js) e funciona offline.
 */
export const getSupportedLanguages = (
	displayLang = 'pt-BR',
): ISupportedLanguage[] => {
	const displayNames = new Intl.DisplayNames([displayLang], {
		type: 'language',
	});

	return SUPPORTED_LANGUAGE_CODES.map((code) => ({
		code,
		// O Intl.DisplayNames pode retornar o próprio código se não conseguir traduzir
		name: displayNames.of(code) || code,
	}));
};

/**
 * Constante estática para uso rápido (em PT-BR).
 */
export const SUPPORTED_LANGUAGES = getSupportedLanguages('pt-BR');
