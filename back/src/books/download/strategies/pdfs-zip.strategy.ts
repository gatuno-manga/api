import { Injectable, StreamableFile, Logger } from '@nestjs/common';
import { DownloadStrategy } from './download.strategy';
import { Chapter } from 'src/books/entitys/chapter.entity';
import archiver from 'archiver';
import { Readable } from 'stream';
import { PdfStrategy } from './pdf.strategy';

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
            `Generating ZIP of PDFs for ${chapters.length} chapters: ${fileName}`,
        );

        // Criar um stream de passagem para o archiver
        const archive = archiver('zip', {
            zlib: { level: 6 },
        });

        const buffers: any[] = [];

        // Coletar dados do stream em buffers
        archive.on('data', (chunk) => buffers.push(chunk));

        // Criar promessa que resolve quando o archive terminar
        const archivePromise = new Promise<void>((resolve, reject) => {
            archive.on('end', () => {
                this.logger.debug('Archive stream ended');
                resolve();
            });
            archive.on('error', (err: Error) => {
                this.logger.error(`Archive error: ${err.message}`);
                reject(err);
            });
        });

        let totalPdfsAdded = 0;

        // Gerar PDF para cada capítulo e adicionar ao ZIP
        for (const chapter of chapters) {
            if (!chapter.pages || chapter.pages.length === 0) {
                this.logger.warn(
                    `Chapter ${chapter.id} (${chapter.title}) has no pages, skipping`,
                );
                continue;
            }

            try {
                this.logger.debug(
                    `Generating PDF for chapter ${chapter.index}: ${chapter.title}`,
                );

                // Gerar PDF do capítulo individual
                const pdfFile = await this.pdfStrategy.generate(
                    [chapter],
                    chapter.title || `Capitulo_${chapter.index}`,
                );

                // Converter o stream do PDF para buffer
                const pdfBuffer = await this.streamToBuffer(
                    pdfFile.getStream(),
                );

                // Nome do arquivo PDF dentro do ZIP
                const pdfFileName = this.sanitizeFileName(
                    `Capitulo_${String(chapter.index).padStart(3, '0')}_${chapter.title || 'Sem_Titulo'}.pdf`,
                );

                // Adicionar ao ZIP
                archive.append(pdfBuffer, { name: pdfFileName });

                totalPdfsAdded++;
                this.logger.debug(`Added PDF: ${pdfFileName}`);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(
                    `Failed to generate PDF for chapter ${chapter.id}: ${errorMessage}`,
                );
            }
        }

        // Finalizar o arquivo
        await archive.finalize();

        // Aguardar a conclusão do stream
        await archivePromise;

        // Combinar todos os buffers
        const finalBuffer = Buffer.concat(buffers);

        this.logger.log(
            `ZIP of PDFs generated successfully: ${finalBuffer.length} bytes, ${totalPdfsAdded} PDFs added`,
        );

        // Retornar como StreamableFile
        const stream = Readable.from(finalBuffer);
        return new StreamableFile(stream);
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
