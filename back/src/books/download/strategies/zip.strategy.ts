import { Injectable, StreamableFile, Logger } from '@nestjs/common';
import { DownloadStrategy } from './download.strategy';
import { Chapter } from 'src/books/entitys/chapter.entity';
import archiver from 'archiver';
import { Readable } from 'stream';
import { promises as fs } from 'fs';
import { join } from 'path';

// Caminho base onde o volume de dados está montado no container
const DATA_BASE_PATH = '/usr/src/app/data';

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
            `Generating ZIP for ${chapters.length} chapters: ${fileName}`,
        );

        // Criar um stream de passagem para o archiver
        const archive = archiver('zip', {
            zlib: { level: 6 }, // Nível de compressão (0-9)
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
            archive.on('error', (err) => {
                this.logger.error(`Archive error: ${err.message}`);
                reject(err);
            });
        });

        let totalPagesAdded = 0;

        // Adicionar páginas ao ZIP
        for (const chapter of chapters) {
            if (!chapter.pages || chapter.pages.length === 0) {
                this.logger.warn(
                    `Chapter ${chapter.id} (${chapter.title}) has no pages`,
                );
                continue;
            }

            // Criar pasta para o capítulo
            const chapterFolder = this.sanitizeFileName(
                `Capitulo ${chapter.index} - ${chapter.title}`,
            );

            for (const page of chapter.pages.sort(
                (a, b) => a.index - b.index,
            )) {
                try {
                    this.logger.debug(
                        `Processing page ${page.id}: original path="${page.path}"`,
                    );

                    // O path no banco é /data/filename.ext (caminho público)
                    // Mas o volume está montado em /usr/src/app/data
                    // Remover /data/ e usar o caminho base correto
                    const cleanPath = page.path.startsWith('/data/')
                        ? page.path.substring(6)
                        : page.path;
                    const filePath = join(DATA_BASE_PATH, cleanPath);

                    this.logger.debug(`Attempting to read file: "${filePath}"`);

                    // Verificar se o arquivo existe
                    await fs.access(filePath);

                    // Ler o arquivo da imagem
                    const imageBuffer = await fs.readFile(filePath);

                    // Extrair extensão do arquivo
                    const ext = cleanPath.split('.').pop() || 'webp';
                    const pageFileName = `${String(page.index).padStart(3, '0')}.${ext}`;

                    // Adicionar ao ZIP
                    archive.append(imageBuffer, {
                        name: `${chapterFolder}/${pageFileName}`,
                    });

                    this.logger.debug(
                        `Successfully added page ${page.index} to ZIP: ${pageFileName}`,
                    );
                    totalPagesAdded++;
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : 'Unknown error';
                    this.logger.error(
                        `Failed to read page ${page.id} (path: "${page.path}") from chapter ${chapter.id}: ${errorMessage}`,
                    );
                    // Continuar com as outras páginas
                }
            }
        }

        // Finalizar o arquivo
        await archive.finalize();

        // Aguardar a conclusão do stream (usando a promessa criada anteriormente)
        await archivePromise;

        // Combinar todos os buffers
        const finalBuffer = Buffer.concat(buffers);

        this.logger.log(
            `ZIP generated successfully: ${finalBuffer.length} bytes, ${totalPagesAdded} pages added`,
        );

        // Retornar como StreamableFile
        const stream = Readable.from(finalBuffer);
        return new StreamableFile(stream);
    }

    private sanitizeFileName(name: string): string {
        // Remover caracteres inválidos para nomes de arquivo
        // eslint-disable-next-line no-control-regex
        return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }
}
