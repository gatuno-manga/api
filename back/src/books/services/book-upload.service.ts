import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Book } from '../entitys/book.entity';
import { Cover } from '../entitys/cover.entity';
import { Page } from '../entitys/page.entity';
import { Chapter } from '../entitys/chapter.entity';
import { FilesService } from 'src/files/files.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Service responsável por upload de capas e páginas de capítulos
 */
@Injectable()
export class BookUploadService {
    private readonly logger = new Logger(BookUploadService.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        @InjectRepository(Cover)
        private readonly coverRepository: Repository<Cover>,
        @InjectRepository(Page)
        private readonly pageRepository: Repository<Page>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        private readonly filesService: FilesService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /**
     * Upload de uma única capa para um livro
     */
    async uploadCover(
        bookId: string,
        file: Express.Multer.File,
        title?: string,
    ): Promise<Cover> {
        this.logger.log(`Uploading cover for book: ${bookId}`);

        const book = await this.bookRepository.findOne({
            where: { id: bookId },
            relations: ['covers'],
        });

        if (!book) {
            this.logger.warn(`Book with id ${bookId} not found`);
            throw new NotFoundException(`Book with id ${bookId} not found`);
        }

        // Validar tipo de arquivo
        if (!file.mimetype.match(/^image\//)) {
            throw new BadRequestException('Only image files are allowed');
        }

        // Extrair extensão
        const extension = path.extname(file.originalname) || '.jpg';

        // Salvar usando o método otimizado (Buffer direto)
        const savedPath = await this.filesService.saveBufferFile(
            file.buffer,
            extension,
        );

        // Criar cover
        const cover = this.coverRepository.create({
            title: title || file.originalname,
            url: savedPath,
            book: book,
            selected: book.covers.length === 0, // Primeira capa é selecionada por padrão
        });

        const savedCover = await this.coverRepository.save(cover);

        this.logger.log(
            `Cover uploaded successfully for book: ${book.title}`,
        );

        // Emitir evento
        this.eventEmitter.emit('cover.uploaded', {
            bookId: book.id,
            coverId: savedCover.id,
            url: savedPath,
        });

        return savedCover;
    }

    /**
     * Upload de múltiplas capas para um livro
     */
    async uploadMultipleCovers(
        bookId: string,
        files: Express.Multer.File[],
    ): Promise<Cover[]> {
        this.logger.log(
            `Uploading ${files.length} covers for book: ${bookId}`,
        );

        if (files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        if (files.length > 10) {
            throw new BadRequestException('Maximum 10 covers per upload');
        }

        const book = await this.bookRepository.findOne({
            where: { id: bookId },
            relations: ['covers'],
        });

        if (!book) {
            this.logger.warn(`Book with id ${bookId} not found`);
            throw new NotFoundException(`Book with id ${bookId} not found`);
        }

        // Processar todos os arquivos em paralelo
        const covers = await Promise.all(
            files.map(async (file, index) => {
                // Validar tipo de arquivo
                if (!file.mimetype.match(/^image\//)) {
                    throw new BadRequestException(
                        `File ${file.originalname} is not an image`,
                    );
                }

                const extension = path.extname(file.originalname) || '.jpg';
                const savedPath = await this.filesService.saveBufferFile(
                    file.buffer,
                    extension,
                );

                return this.coverRepository.create({
                    title: file.originalname,
                    url: savedPath,
                    book: book,
                    selected: book.covers.length === 0 && index === 0,
                });
            }),
        );

        const savedCovers = await this.coverRepository.save(covers);

        this.logger.log(
            `${savedCovers.length} covers uploaded successfully for book: ${book.title}`,
        );

        // Emitir evento
        this.eventEmitter.emit('covers.uploaded', {
            bookId: book.id,
            count: savedCovers.length,
            coverIds: savedCovers.map((c) => c.id),
        });

        return savedCovers;
    }

    /**
     * Upload de páginas para um capítulo
     */
    async uploadChapterPages(
        chapterId: string,
        files: Express.Multer.File[],
        indices: number[],
    ): Promise<Page[]> {
        this.logger.log(
            `Uploading ${files.length} pages for chapter: ${chapterId}`,
        );

        // Validações
        if (files.length === 0) {
            throw new BadRequestException('No files provided');
        }

        if (files.length !== indices.length) {
            throw new BadRequestException(
                'Number of files must match number of indices',
            );
        }

        if (files.length > 100) {
            throw new BadRequestException('Maximum 100 pages per upload');
        }

        // Verificar duplicação de índices
        const uniqueIndices = new Set(indices);
        if (uniqueIndices.size !== indices.length) {
            throw new BadRequestException('Duplicate indices found');
        }

        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
            relations: ['pages', 'book'],
        });

        if (!chapter) {
            this.logger.warn(`Chapter with id ${chapterId} not found`);
            throw new NotFoundException(
                `Chapter with id ${chapterId} not found`,
            );
        }

        // Verificar se algum índice já existe
        const existingIndices = chapter.pages.map((p) => p.index);
        const conflictingIndices = indices.filter((i) =>
            existingIndices.includes(i),
        );

        if (conflictingIndices.length > 0) {
            throw new BadRequestException(
                `Pages with indices ${conflictingIndices.join(', ')} already exist`,
            );
        }

        // Processar todos os arquivos em paralelo
        const pages = await Promise.all(
            files.map(async (file, i) => {
                // Validar tipo de arquivo
                if (!file.mimetype.match(/^image\//)) {
                    throw new BadRequestException(
                        `File ${file.originalname} is not an image`,
                    );
                }

                const extension = path.extname(file.originalname) || '.jpg';
                const savedPath = await this.filesService.saveBufferFile(
                    file.buffer,
                    extension,
                );

                return this.pageRepository.create({
                    index: indices[i],
                    path: savedPath,
                    chapter: chapter,
                });
            }),
        );

        const savedPages = await this.pageRepository.save(pages);

        this.logger.log(
            `${savedPages.length} pages uploaded successfully for chapter: ${chapter.title || chapter.id}`,
        );

        // Emitir evento
        this.eventEmitter.emit('chapter.pages.uploaded', {
            chapterId: chapter.id,
            bookId: chapter.book?.id,
            count: savedPages.length,
        });

        return savedPages;
    }
}
