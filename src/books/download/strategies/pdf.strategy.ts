import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { Chapter } from 'src/books/entities/chapter.entity';
import { DownloadStrategy } from './download.strategy';

// Caminho base onde o volume de dados está montado no container
const DATA_BASE_PATH = '/usr/src/app/data';

@Injectable()
export class PdfStrategy implements DownloadStrategy {
	private readonly logger = new Logger(PdfStrategy.name);

	getContentType(): string {
		return 'application/pdf';
	}

	getExtension(): string {
		return 'pdf';
	}

	async generate(
		chapters: Chapter[],
		fileName: string,
	): Promise<StreamableFile> {
		this.logger.log(
			`Generating PDF for ${chapters.length} chapters: ${fileName}`,
		);

		// Stream de passagem para enviar dados enquanto gera
		const outputStream = new PassThrough();

		// Criar documento PDF
		const doc = new PDFDocument({
			autoFirstPage: false,
			bufferPages: false, // Desabilitar buffer de páginas para streaming
		});

		// Pipe do PDFKit para o output stream
		doc.pipe(outputStream);

		// Error handling
		doc.on('error', (err: Error) => {
			this.logger.error(`PDF error: ${err.message}`);
			outputStream.destroy(err);
		});

		// Gerar PDF em background
		this.generatePdfAsync(doc, chapters)
			.then(() => {
				this.logger.debug('PDF generation complete');
			})
			.catch((err) => {
				this.logger.error(`PDF generation failed: ${err.message}`);
				outputStream.destroy(err);
			});

		// Retornar imediatamente o stream
		return new StreamableFile(outputStream);
	}

	/**
	 * Gera o conteúdo do PDF de forma assíncrona
	 */
	private async generatePdfAsync(
		doc: PDFKit.PDFDocument,
		chapters: Chapter[],
	): Promise<void> {
		let totalPagesAdded = 0;

		for (const chapter of chapters) {
			if (!chapter.pages || chapter.pages.length === 0) {
				this.logger.warn(
					`Chapter ${chapter.id} (${chapter.title}) has no pages`,
				);
				continue;
			}

			// Adicionar página de título do capítulo
			doc.addPage()
				.fontSize(24)
				.font('Helvetica-Bold')
				.text(`Capítulo ${chapter.index}`, { align: 'center' })
				.moveDown()
				.fontSize(18)
				.font('Helvetica')
				.text(chapter.title || '', { align: 'center' });

			// Adicionar imagens das páginas
			for (const page of chapter.pages.sort(
				(a, b) => a.index - b.index,
			)) {
				try {
					// O path no banco é /data/filename.ext (caminho público)
					const cleanPath = page.path.startsWith('/data/')
						? page.path.substring(6)
						: page.path;

					const filePath = join(DATA_BASE_PATH, cleanPath);

					// Ler o arquivo da imagem
					const rawImageBuffer = await fs.readFile(filePath);

					// Converter para PNG (PDFKit não suporta WebP nativamente)
					const sharpInstance = sharp(rawImageBuffer);
					const metadata = await sharpInstance.metadata();
					const imageBuffer = await sharpInstance.png().toBuffer();

					if (!metadata.width || !metadata.height) {
						this.logger.warn(
							`Could not determine dimensions for page ${page.id}`,
						);
						continue;
					}

					// Usar o tamanho original da imagem para a página
					const width = metadata.width;
					const height = metadata.height;

					// Adicionar nova página com o tamanho exato da imagem
					doc.addPage({ size: [width, height] }).image(
						imageBuffer,
						0,
						0,
						{
							width,
							height,
						},
					);

					totalPagesAdded++;
				} catch (error) {
					const errorMessage =
						error instanceof Error
							? error.message
							: 'Unknown error';
					this.logger.error(
						`Failed to process page ${page.id}: ${errorMessage}`,
					);
				}
			}
		}

		this.logger.log(`Finalizing PDF with ${totalPagesAdded} pages`);

		// Finalizar o documento
		doc.end();
	}
}
