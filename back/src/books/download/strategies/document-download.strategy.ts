import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { Chapter } from 'src/books/entitys/chapter.entity';
import { ContentType } from '../../enum/content-type.enum';
import { DocumentFormat } from '../../enum/document-format.enum';
import { DownloadStrategy } from './download.strategy';

// Caminho base onde o volume de dados está montado no container
const DATA_BASE_PATH = '/usr/src/app/data';

/**
 * Strategy para download de documentos (PDF/EPUB)
 * Retorna o arquivo original sem processamento
 */
@Injectable()
export class DocumentDownloadStrategy implements DownloadStrategy {
	private readonly logger = new Logger(DocumentDownloadStrategy.name);
	private documentFormat: DocumentFormat = DocumentFormat.PDF;

	/**
	 * Define o formato do documento para determinar content-type e extensão
	 */
	setDocumentFormat(format: DocumentFormat): void {
		this.documentFormat = format;
	}

	getContentType(): string {
		switch (this.documentFormat) {
			case DocumentFormat.EPUB:
				return 'application/epub+zip';
			default:
				return 'application/pdf';
		}
	}

	getExtension(): string {
		switch (this.documentFormat) {
			case DocumentFormat.EPUB:
				return 'epub';
			default:
				return 'pdf';
		}
	}

	async generate(
		chapters: Chapter[],
		fileName: string,
	): Promise<StreamableFile> {
		this.logger.log(
			`Generating document download for ${chapters.length} chapters: ${fileName}`,
		);

		// Filtra apenas capítulos do tipo DOCUMENT
		const documentChapters = chapters.filter(
			(ch) => ch.contentType === ContentType.DOCUMENT && ch.documentPath,
		);

		if (documentChapters.length === 0) {
			throw new Error('Nenhum capítulo com documento disponível');
		}

		// Para um único capítulo, retorna o arquivo diretamente
		if (documentChapters.length === 1) {
			const chapter = documentChapters[0];
			return await this.streamSingleDocument(chapter);
		}

		// Para múltiplos capítulos de documentos, precisaria zipar
		// Por enquanto, retorna apenas o primeiro (caso comum)
		this.logger.warn(
			'Múltiplos documentos solicitados, retornando apenas o primeiro',
		);
		return await this.streamSingleDocument(documentChapters[0]);
	}

	/**
	 * Stream de um único documento para o cliente
	 */
	private async streamSingleDocument(
		chapter: Chapter,
	): Promise<StreamableFile> {
		if (!chapter.documentPath) {
			throw new Error('Capítulo não possui documento associado');
		}

		const cleanPath = chapter.documentPath.startsWith('/data/')
			? chapter.documentPath.substring(6)
			: chapter.documentPath;

		const filePath = join(DATA_BASE_PATH, cleanPath);

		this.logger.debug(`Streaming document from: ${filePath}`);

		try {
			// Verifica se o arquivo existe
			await fs.access(filePath);

			// Lê o arquivo e cria stream
			const fileBuffer = await fs.readFile(filePath);
			const outputStream = new PassThrough();

			// Define o formato baseado no capítulo
			if (chapter.documentFormat) {
				this.setDocumentFormat(chapter.documentFormat);
			}

			// Escreve o buffer no stream
			outputStream.end(fileBuffer);

			this.logger.log(
				`Document streamed successfully: ${chapter.title || chapter.id}`,
			);

			return new StreamableFile(outputStream);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(
				`Failed to stream document for chapter ${chapter.id}: ${errorMessage}`,
			);
			throw new Error(`Falha ao ler documento: ${errorMessage}`);
		}
	}
}
