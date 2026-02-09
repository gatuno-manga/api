import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import archiver from 'archiver';
import { Chapter } from 'src/books/entities/chapter.entity';
import { DownloadStrategy } from './download.strategy';

// Caminho base onde o volume de dados está montado no container
const DATA_BASE_PATH = '/usr/src/app/data';

// Configuração de paralelismo
const PARALLEL_CHAPTERS = 4; // Capítulos processados em paralelo
const PARALLEL_PAGES = 8; // Páginas por capítulo em paralelo

interface PageData {
	chapterIndex: number;
	chapterFolder: string;
	pageIndex: number;
	fileName: string;
	buffer: Buffer;
}

@Injectable()
export class ZipStrategy implements DownloadStrategy {
	private readonly logger = new Logger(ZipStrategy.name);

	getContentType(): string {
		return 'application/zip';
	}

	getExtension(): string {
		return 'zip';
	}

	async generate(
		chapters: Chapter[],
		fileName: string,
	): Promise<StreamableFile> {
		this.logger.log(
			`Generating ZIP for ${chapters.length} chapters: ${fileName} (parallel: ${PARALLEL_CHAPTERS} chapters, ${PARALLEL_PAGES} pages)`,
		);

		// Stream de passagem para enviar dados enquanto gera
		const outputStream = new PassThrough();

		// Criar archiver com streaming
		const archive = archiver('zip', {
			zlib: { level: 6 },
		});

		// Pipe do archiver para o output stream
		archive.pipe(outputStream);

		// Error handling
		archive.on('error', (err: Error) => {
			this.logger.error(`Archive error: ${err.message}`);
			outputStream.destroy(err);
		});

		archive.on('warning', (err: Error) => {
			this.logger.warn(`Archive warning: ${err.message}`);
		});

		// Gerar ZIP em background com paralelismo
		this.generateZipParallel(archive, chapters)
			.then(() => {
				this.logger.debug('All files added, archive finalized');
			})
			.catch((err) => {
				this.logger.error(`ZIP generation failed: ${err.message}`);
				outputStream.destroy(err);
			});

		// Retornar imediatamente o stream
		return new StreamableFile(outputStream);
	}

	/**
	 * Gera ZIP com processamento paralelo de capítulos
	 */
	private async generateZipParallel(
		archive: archiver.Archiver,
		chapters: Chapter[],
	): Promise<void> {
		const startTime = Date.now();
		let totalPagesAdded = 0;

		// Processar capítulos em lotes paralelos
		for (let i = 0; i < chapters.length; i += PARALLEL_CHAPTERS) {
			const batch = chapters.slice(i, i + PARALLEL_CHAPTERS);

			this.logger.debug(
				`Processing chapter batch ${Math.floor(i / PARALLEL_CHAPTERS) + 1}/${Math.ceil(chapters.length / PARALLEL_CHAPTERS)}`,
			);

			// Processar lote em paralelo
			const batchResults = await Promise.all(
				batch.map((chapter) => this.processChapterParallel(chapter)),
			);

			// Adicionar ao archive na ordem correta (já ordenado por chapterIndex e pageIndex)
			for (const chapterPages of batchResults) {
				for (const pageData of chapterPages) {
					archive.append(pageData.buffer, {
						name: `${pageData.chapterFolder}/${pageData.fileName}`,
					});
					totalPagesAdded++;
				}
			}
		}

		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		this.logger.log(
			`Finalizing archive with ${totalPagesAdded} pages (processed in ${duration}s)`,
		);

		// Finalizar o arquivo
		await archive.finalize();
	}

	/**
	 * Processa um capítulo com páginas em paralelo
	 */
	private async processChapterParallel(
		chapter: Chapter,
	): Promise<PageData[]> {
		if (!chapter.pages || chapter.pages.length === 0) {
			this.logger.warn(
				`Chapter ${chapter.id} (${chapter.title}) has no pages`,
			);
			return [];
		}

		const chapterFolder = this.sanitizeFileName(
			`Capitulo ${chapter.index} - ${chapter.title}`,
		);

		const sortedPages = chapter.pages.sort((a, b) => a.index - b.index);
		const results: PageData[] = [];

		// Processar páginas em lotes paralelos
		for (let i = 0; i < sortedPages.length; i += PARALLEL_PAGES) {
			const pageBatch = sortedPages.slice(i, i + PARALLEL_PAGES);

			const batchResults = await Promise.all(
				pageBatch.map(async (page) => {
					try {
						const cleanPath = page.path.startsWith('/data/')
							? page.path.substring(6)
							: page.path;
						const filePath = join(DATA_BASE_PATH, cleanPath);

						// Ler arquivo
						const buffer = await fs.readFile(filePath);

						// Extrair extensão
						const ext = cleanPath.split('.').pop() || 'webp';
						const fileName = `${String(page.index).padStart(3, '0')}.${ext}`;

						return {
							chapterIndex: chapter.index,
							chapterFolder,
							pageIndex: page.index,
							fileName,
							buffer,
						} as PageData;
					} catch (error) {
						const errorMessage =
							error instanceof Error
								? error.message
								: 'Unknown error';
						this.logger.error(
							`Failed to read page ${page.id}: ${errorMessage}`,
						);
						return null;
					}
				}),
			);

			// Filtrar nulls e adicionar resultados
			results.push(
				...batchResults.filter((r): r is PageData => r !== null),
			);
		}

		// Ordenar por índice da página (garantir ordem)
		return results.sort((a, b) => a.pageIndex - b.pageIndex);
	}

	private sanitizeFileName(name: string): string {
		// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional sanitization of control characters
		return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
	}
}
