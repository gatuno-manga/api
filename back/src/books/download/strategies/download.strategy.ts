import { StreamableFile } from '@nestjs/common';
import { Chapter } from 'src/books/entitys/chapter.entity';

export interface DownloadStrategy {
	/**
	 * Gera um arquivo para download a partir dos capítulos fornecidos
	 * @param chapters - Lista de capítulos com suas páginas
	 * @param fileName - Nome do arquivo a ser gerado
	 * @returns StreamableFile para enviar ao cliente
	 */
	generate(chapters: Chapter[], fileName: string): Promise<StreamableFile>;

	/**
	 * Retorna o Content-Type apropriado para o formato
	 */
	getContentType(): string;

	/**
	 * Retorna a extensão do arquivo
	 */
	getExtension(): string;
}
