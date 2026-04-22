/**
 * DTO para capítulos extraídos do scraping
 */
export interface ScrapedChapterDto {
	/**
	 * Título do capítulo
	 */
	title: string;

	/**
	 * URL original do capítulo
	 */
	url: string;

	/**
	 * Índice/número do capítulo
	 */
	index: number;

	/**
	 * Indica se este é o capítulo final da obra
	 */
	isFinal?: boolean;
}

/**
 * DTO para capas extraídas do scraping
 */
export interface ScrapedCoverDto {
	/**
	 * URL da imagem de capa
	 */
	url: string;

	/**
	 * Título/descrição da capa (ex: "Capa Volume 1", "Capa Alternativa")
	 */
	title?: string;
}

/**
 * DTO para informações extraídas do livro (saída do bookInfoExtractScript)
 */
export interface ScrapedBookInfoDto {
	/**
	 * Capas do livro (array de objetos com url e title)
	 */
	covers?: ScrapedCoverDto[];

	/**
	 * Lista de capítulos extraídos
	 */
	chapters: ScrapedChapterDto[];
}
