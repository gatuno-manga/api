import stripComments from 'strip-comments';

/**
 * Minifica um script JavaScript removendo comentários e espaços desnecessários.
 * Ideal para ser chamado antes de persistir o script no banco de dados.
 */
export function minifyScrapingScript(
	script: string | undefined | null,
): string {
	if (!script || typeof script !== 'string') {
		return '';
	}

	try {
		// 1. Remove todos os comentários (single-line, multi-line, JSDoc)
		const withoutComments = stripComments(script);

		// 2. Processamento de espaços e quebras
		const minified = withoutComments
			.split('\n')
			.map((line) => line.trim()) // Remove espaços nas extremidades
			.filter((line) => line.length > 0) // Remove linhas que ficaram vazias
			.join(' '); // Junta com espaço para evitar colagem de tokens

		// 3. Limpeza de espaços duplos
		return minified.replace(/\s+/g, ' ').trim();
	} catch (error) {
		// Fallback: se algo falhar, retorna o original
		return script;
	}
}
