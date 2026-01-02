import {
    Injectable,
    Logger,
    NotFoundException,
    StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { Book } from '../entitys/book.entity';
import { DownloadCacheService } from './download-cache.service';
import { ZipStrategy } from './strategies/zip.strategy';
import { PdfStrategy } from './strategies/pdf.strategy';
import { PdfsZipStrategy } from './strategies/pdfs-zip.strategy';
import {
    ChapterDownloadFormat,
    DownloadChapterQueryDto,
} from './dto/download-chapter-query.dto';
import {
    BookDownloadFormat,
    DownloadBookBodyDto,
} from './dto/download-book-body.dto';
import { Readable } from 'stream';

@Injectable()
export class DownloadService {
    private readonly logger = new Logger(DownloadService.name);

    constructor(
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly cacheService: DownloadCacheService,
        private readonly zipStrategy: ZipStrategy,
        private readonly pdfStrategy: PdfStrategy,
        private readonly pdfsZipStrategy: PdfsZipStrategy,
    ) {}

    /**
     * Download de um capítulo individual
     */
    async downloadChapter(
        chapterId: string,
        query: DownloadChapterQueryDto,
    ): Promise<{
        file: StreamableFile;
        fileName: string;
        contentType: string;
    }> {
        this.logger.log(`Downloading chapter ${chapterId} as ${query.format}`);

        // Buscar capítulo com páginas e livro
        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
            relations: ['pages', 'book'],
        });

        if (!chapter) {
            throw new NotFoundException(
                `Chapter with id ${chapterId} not found`,
            );
        }

        if (!chapter.pages || chapter.pages.length === 0) {
            throw new NotFoundException(
                `Chapter ${chapterId} has no pages available`,
            );
        }

        // Selecionar estratégia baseada no formato
        const strategy =
            query.format === ChapterDownloadFormat.PDF
                ? this.pdfStrategy
                : this.zipStrategy;

        // Verificar cache
        const cachedFile = await this.cacheService.get(
            [chapterId],
            query.format,
            strategy.getExtension(),
        );

        if (cachedFile) {
            this.logger.log(`Returning cached file for chapter ${chapterId}`);
            const stream = Readable.from(cachedFile);
            const fileName = this.generateFileName(
                [chapter],
                strategy.getExtension(),
            );
            return {
                file: new StreamableFile(stream, {
                    type: strategy.getContentType(),
                    disposition: `attachment; filename="${fileName}"`,
                }),
                fileName,
                contentType: strategy.getContentType(),
            };
        }

        // Gerar arquivo
        const file = await strategy.generate([chapter], chapter.title);
        const fileName = this.generateFileName(
            [chapter],
            strategy.getExtension(),
        );

        // Cachear para futuras requisições
        const buffer = await this.streamToBuffer(file.getStream());
        await this.cacheService.set(
            [chapterId],
            query.format,
            strategy.getExtension(),
            buffer,
        );

        // Retornar arquivo gerado
        const stream = Readable.from(buffer);
        return {
            file: new StreamableFile(stream, {
                type: strategy.getContentType(),
                disposition: `attachment; filename="${fileName}"`,
            }),
            fileName,
            contentType: strategy.getContentType(),
        };
    }

    /**
     * Download de um livro com capítulos selecionados
     */
    async downloadBook(
        bookId: string,
        dto: DownloadBookBodyDto,
    ): Promise<{
        file: StreamableFile;
        fileName: string;
        contentType: string;
    }> {
        const requestedIds = dto.chapterIds || [];
        const downloadAll = requestedIds.length === 0;
        this.logger.log(
            `Downloading book ${bookId} with ${downloadAll ? 'all' : requestedIds.length} chapters as ${dto.format}`,
        );

        // Buscar livro
        const book = await this.bookRepository.findOne({
            where: { id: bookId },
        });

        if (!book) {
            throw new NotFoundException(`Book with id ${bookId} not found`);
        }

        // Buscar capítulos (todos ou selecionados)
        let chapters: Chapter[];
        if (downloadAll) {
            // Buscar todos os capítulos do livro
            chapters = await this.chapterRepository.find({
                where: { book: { id: bookId } },
                relations: ['pages'],
                order: { index: 'ASC' },
            });
        } else {
            // Buscar capítulos selecionados
            chapters = await this.chapterRepository.find({
                where: {
                    id: In(requestedIds),
                    book: { id: bookId },
                },
                relations: ['pages'],
                order: { index: 'ASC' },
            });

            if (chapters.length !== requestedIds.length) {
                this.logger.warn(
                    `Requested ${requestedIds.length} chapters, but only ${chapters.length} were found`,
                );
            }
        }

        // Verificar se há páginas
        const totalPages = chapters.reduce(
            (sum, ch) => sum + (ch.pages?.length || 0),
            0,
        );
        if (totalPages === 0) {
            throw new NotFoundException(
                `No pages available for the selected chapters`,
            );
        }

        // Determinar estratégia baseada no formato
        let strategy: ZipStrategy | PdfsZipStrategy;
        let formatKey: string;

        if (dto.format === BookDownloadFormat.PDFS_ZIP) {
            // ZIP de PDFs: gerar PDF para cada capítulo e empacotar
            formatKey = 'pdfs_zip';
            strategy = this.pdfsZipStrategy;
            this.logger.log('Using PDFs ZIP strategy');
        } else {
            // ZIP de imagens
            formatKey = 'images_zip';
            strategy = this.zipStrategy;
        }

        // Obter IDs dos capítulos para cache
        const chapterIdsForCache = chapters.map((ch) => ch.id);

        // Verificar cache
        const cachedFile = await this.cacheService.get(
            chapterIdsForCache,
            formatKey,
            strategy.getExtension(),
        );

        if (cachedFile) {
            this.logger.log(`Returning cached file for book ${bookId}`);
            const stream = Readable.from(cachedFile);
            const fileName = this.generateFileName(
                chapters,
                strategy.getExtension(),
                book.title,
            );
            return {
                file: new StreamableFile(stream, {
                    type: strategy.getContentType(),
                    disposition: `attachment; filename="${fileName}"`,
                }),
                fileName,
                contentType: strategy.getContentType(),
            };
        }

        // Gerar arquivo
        const file = await strategy.generate(chapters, book.title);
        const fileName = this.generateFileName(
            chapters,
            strategy.getExtension(),
            book.title,
        );

        // Cachear para futuras requisições
        const buffer = await this.streamToBuffer(file.getStream());
        await this.cacheService.set(
            chapterIdsForCache,
            formatKey,
            strategy.getExtension(),
            buffer,
        );

        // Retornar arquivo gerado
        const stream = Readable.from(buffer);
        return {
            file: new StreamableFile(stream, {
                type: strategy.getContentType(),
                disposition: `attachment; filename="${fileName}"`,
            }),
            fileName,
            contentType: strategy.getContentType(),
        };
    }

    /**
     * Gera um nome de arquivo descritivo
     */
    private generateFileName(
        chapters: Chapter[],
        extension: string,
        bookTitle?: string,
    ): string {
        if (chapters.length === 1) {
            const chapter = chapters[0];
            const sanitized = this.sanitizeFileName(
                `Capitulo_${chapter.index}_${chapter.title}`,
            );
            return `${sanitized}.${extension}`;
        }

        const sanitized = this.sanitizeFileName(bookTitle || 'Livro_Completo');
        return `${sanitized}_${chapters.length}_capitulos.${extension}`;
    }

    /**
     * Remove caracteres inválidos de nomes de arquivo
     */
    private sanitizeFileName(name: string): string {
        // eslint-disable-next-line no-control-regex
        return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
    }

    /**
     * Converte um stream em buffer
     */
    private async streamToBuffer(stream: Readable): Promise<Buffer> {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    }
}
