import { Injectable, StreamableFile, Logger } from '@nestjs/common';
import { DownloadStrategy } from './download.strategy';
import { Chapter } from 'src/books/entitys/chapter.entity';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

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

        // Criar documento PDF
        const doc = new PDFDocument({
            autoFirstPage: false,
            bufferPages: true,
        });

        const buffers: any[] = [];

        // Coletar dados do stream em buffers
        doc.on('data', (chunk) => buffers.push(chunk));

        // Criar promessa que resolve quando o documento terminar (ANTES de adicionar conteúdo)
        const pdfPromise = new Promise<void>((resolve, reject) => {
            doc.on('end', () => {
                this.logger.debug('PDF stream ended');
                resolve();
            });
            doc.on('error', (err: Error) => {
                this.logger.error(`PDF error: ${err.message}`);
                reject(err);
            });
        });

        let totalPagesAdded = 0;

        // Adicionar páginas ao PDF
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
                    // Mas o volume está montado em /usr/src/app/data
                    const cleanPath = page.path.startsWith('/data/')
                        ? page.path.substring(6)
                        : page.path;

                    const filePath = join(DATA_BASE_PATH, cleanPath);

                    this.logger.debug(
                        `Processing page ${page.id}: ${filePath}`,
                    );

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
                    this.logger.debug(
                        `Added page ${page.index} to PDF (${width}x${height})`,
                    );
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : 'Unknown error';
                    this.logger.error(
                        `Failed to process page ${page.id} from chapter ${chapter.id}: ${errorMessage}`,
                    );
                    // Continuar com as outras páginas
                }
            }
        }

        // Finalizar o documento
        doc.end();

        // Aguardar a conclusão do stream (usando a promessa criada anteriormente)
        await pdfPromise;

        // Combinar todos os buffers
        const finalBuffer = Buffer.concat(buffers);

        this.logger.log(
            `PDF generated successfully: ${finalBuffer.length} bytes, ${totalPagesAdded} pages`,
        );

        // Retornar como StreamableFile
        const stream = Readable.from(finalBuffer);
        return new StreamableFile(stream);
    }
}
