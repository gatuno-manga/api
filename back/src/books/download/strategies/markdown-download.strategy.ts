import { PassThrough } from 'node:stream';
import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { Chapter } from 'src/books/entitys/chapter.entity';
import { ContentFormat } from '../../enum/content-format.enum';
import { ContentType } from '../../enum/content-type.enum';
import { DownloadStrategy } from './download.strategy';

/**
 * Strategy para download de conteúdo textual como arquivo Markdown
 * Combina múltiplos capítulos em um único arquivo .md
 */
@Injectable()
export class MarkdownDownloadStrategy implements DownloadStrategy {
	private readonly logger = new Logger(MarkdownDownloadStrategy.name);

	getContentType(): string {
		return 'text/markdown';
	}

	getExtension(): string {
		return 'md';
	}

	async generate(
		chapters: Chapter[],
		fileName: string,
	): Promise<StreamableFile> {
		this.logger.log(
			`Generating Markdown download for ${chapters.length} chapters: ${fileName}`,
		);

		// Filtra apenas capítulos do tipo TEXT
		const textChapters = chapters.filter(
			(ch) => ch.contentType === ContentType.TEXT && ch.content,
		);

		if (textChapters.length === 0) {
			throw new Error('Nenhum capítulo com conteúdo textual disponível');
		}

		const outputStream = new PassThrough();

		// Gera o Markdown combinando todos os capítulos
		const markdownContent = this.generateCombinedMarkdown(
			textChapters,
			fileName,
		);

		// Escreve no stream
		outputStream.end(Buffer.from(markdownContent, 'utf-8'));

		this.logger.log(
			`Markdown generated with ${textChapters.length} chapters`,
		);

		return new StreamableFile(outputStream);
	}

	/**
	 * Gera um arquivo Markdown combinando múltiplos capítulos
	 */
	private generateCombinedMarkdown(
		chapters: Chapter[],
		bookTitle: string,
	): string {
		const lines: string[] = [];

		// Cabeçalho do livro
		lines.push(`# ${bookTitle}`);
		lines.push('');
		lines.push(
			`> Gerado automaticamente em ${new Date().toLocaleDateString('pt-BR')}`,
		);
		lines.push('');
		lines.push('---');
		lines.push('');

		// Índice
		lines.push('## Índice');
		lines.push('');
		for (const chapter of chapters) {
			const title = chapter.title || `Capítulo ${chapter.index}`;
			const anchor = this.generateAnchor(title);
			lines.push(`- [${title}](#${anchor})`);
		}
		lines.push('');
		lines.push('---');
		lines.push('');

		// Conteúdo dos capítulos
		for (const chapter of chapters) {
			const title = chapter.title || `Capítulo ${chapter.index}`;

			lines.push(`## ${title}`);
			lines.push('');

			// Converte conteúdo baseado no formato original
			const content = this.formatContent(
				chapter.content || '',
				chapter.contentFormat,
			);
			lines.push(content);
			lines.push('');
			lines.push('---');
			lines.push('');
		}

		return lines.join('\n');
	}

	/**
	 * Gera anchor para links internos
	 */
	private generateAnchor(title: string): string {
		return title
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.trim();
	}

	/**
	 * Formata o conteúdo baseado no formato original
	 */
	private formatContent(
		content: string,
		format: ContentFormat | null,
	): string {
		if (!content) return '';

		switch (format) {
			case ContentFormat.HTML:
				// Conversão básica de HTML para Markdown
				return this.htmlToMarkdown(content);
			case ContentFormat.PLAIN:
				// Texto puro: adiciona quebras de parágrafo
				return content
					.split('\n\n')
					.map((p) => p.trim())
					.filter((p) => p)
					.join('\n\n');
			default:
				// Já é Markdown, retorna como está
				return content;
		}
	}

	/**
	 * Conversão básica de HTML para Markdown
	 * Para conversão mais robusta, usar biblioteca como turndown
	 */
	private htmlToMarkdown(html: string): string {
		return (
			html
				// Headers
				.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
				.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
				.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
				.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
				// Formatação
				.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
				.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
				.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
				.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
				// Parágrafos e quebras
				.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
				.replace(/<br\s*\/?>/gi, '\n')
				// Links
				.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
				// Listas
				.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
				.replace(/<\/?[ou]l[^>]*>/gi, '\n')
				// Remove outras tags
				.replace(/<[^>]+>/g, '')
				// Limpa espaços extras
				.replace(/\n{3,}/g, '\n\n')
				.trim()
		);
	}
}
