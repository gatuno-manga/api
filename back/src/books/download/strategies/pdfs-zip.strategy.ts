import { Injectable, StreamableFile, Logger } from '@nestjs/common';
import { DownloadStrategy } from './download.strategy';
import { Chapter } from 'src/books/entitys/chapter.entity';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';
import { PdfStrategy } from './pdf.strategy';

// Configuração de paralelismo para PDFs
const PARALLEL_PDF_GENERATION = 3; // PDFs gerados em paralelo (mais pesado que imagens)

interface PdfData {
    chapterIndex: number;
    fileName: string;
    buffer: Buffer;
}

@Injectable()
export class PdfsZipStrategy implements DownloadStrategy {
    private readonly logger = new Logger(PdfsZipStrategy.name);

    constructor(private readonly pdfStrategy: PdfStrategy) {}

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
            `Generating ZIP of PDFs for ${chapters.length} chapters: ${fileName} (parallel: ${PARALLEL_PDF_GENERATION})`,
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

        // Gerar PDFs em paralelo e adicionar ao ZIP
        this.generatePdfsParallel(archive, chapters)
            .then(() => {
                this.logger.debug('All PDFs added, archive finalized');
            })
            .catch((err) => {
                this.logger.error(`PDF generation failed: ${err.message}`);
                outputStream.destroy(err);
            });

        // Retornar imediatamente o stream
        return new StreamableFile(outputStream);
    }

    /**
     * Gera PDFs em paralelo e adiciona ao archive
     */
    private async generatePdfsParallel(
        archive: archiver.Archiver,
        chapters: Chapter[],
    ): Promise<void> {
        const startTime = Date.now();
        let totalPdfsAdded = 0;

        // Filtrar capítulos válidos
        const validChapters = chapters.filter(
            (ch) => ch.pages && ch.pages.length > 0,
        );

        // Processar em lotes paralelos
        for (let i = 0; i < validChapters.length; i += PARALLEL_PDF_GENERATION) {
            const batch = validChapters.slice(i, i + PARALLEL_PDF_GENERATION);

            this.logger.debug(
                `Processing PDF batch ${Math.floor(i / PARALLEL_PDF_GENERATION) + 1}/${Math.ceil(validChapters.length / PARALLEL_PDF_GENERATION)}`,
            );

            // Gerar PDFs em paralelo
            const batchResults = await Promise.all(
                batch.map((chapter) => this.generateSinglePdf(chapter)),
            );

            // Ordenar por índice do capítulo e adicionar ao archive
            const sortedResults = batchResults
                .filter((r): r is PdfData => r !== null)
                .sort((a, b) => a.chapterIndex - b.chapterIndex);

            for (const pdfData of sortedResults) {
                archive.append(pdfData.buffer, { name: pdfData.fileName });
                totalPdfsAdded++;
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.log(
            `Finalizing archive with ${totalPdfsAdded} PDFs (processed in ${duration}s)`,
        );

        // Finalizar o arquivo
        await archive.finalize();
    }

    /**
     * Gera um único PDF para um capítulo
     */
    private async generateSinglePdf(chapter: Chapter): Promise<PdfData | null> {
        try {
            this.logger.debug(
                `Generating PDF for chapter ${chapter.index}: ${chapter.title}`,
            );

            // Gerar PDF do capítulo
            const pdfFile = await this.pdfStrategy.generate(
                [chapter],
                chapter.title || `Capitulo_${chapter.index}`,
            );

            // Converter stream para buffer
            const buffer = await this.streamToBuffer(pdfFile.getStream());

            // Nome do arquivo
            const fileName = this.sanitizeFileName(
                `Capitulo_${String(chapter.index).padStart(3, '0')}_${chapter.title || 'Sem_Titulo'}.pdf`,
            );

            this.logger.debug(
                `Generated PDF: ${fileName} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`,
            );

            return {
                chapterIndex: chapter.index,
                fileName,
                buffer,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(
                `Failed to generate PDF for chapter ${chapter.id}: ${errorMessage}`,
            );
            return null;
        }
    }

    private sanitizeFileName(name: string): string {
        // eslint-disable-next-line no-control-regex
        return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }

    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
}
