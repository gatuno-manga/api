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
}
