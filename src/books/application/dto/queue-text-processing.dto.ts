import { ContentFormat } from '../../domain/enums/content-format.enum';

/**
 * DTO para processamento de texto assíncrono (extração e espelhamento de imagens)
 */
export class QueueTextProcessingDto {
	/**
	 * ID da entidade que contém o texto (Chapter ou ChapterComment)
	 */
	entityId: string;

	/**
	 * Origem do texto para saber qual repositório atualizar
	 */
	source: 'CHAPTER' | 'COMMENT';

	/**
	 * Formato do texto para escolher o parser adequado (remark ou cheerio)
	 */
	format: ContentFormat;
}
