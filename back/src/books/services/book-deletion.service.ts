import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { Cover } from '../entitys/cover.entity';
import { Page } from '../entitys/page.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface DeletionResult {
    deletedBooks?: number;
    deletedChapters?: number;
    deletedPages?: number;
    deletedCovers?: number;
    filesScheduledForDeletion: number;
    success: boolean;
    errors?: string[];
}

@Injectable()
export class BookDeletionService {
    private readonly logger = new Logger(BookDeletionService.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        @InjectRepository(Cover)
        private readonly coverRepository: Repository<Cover>,
        @InjectRepository(Page)
        private readonly pageRepository: Repository<Page>,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async deleteBook(bookId: string): Promise<DeletionResult> {
        this.logger.log(`Deleting book: ${bookId}`);

        const book = await this.bookRepository.findOne({
            where: { id: bookId },
            relations: ['chapters', 'chapters.pages', 'covers'],
        });

        if (!book) {
            throw new NotFoundException(`Book with id ${bookId} not found`);
        }

        const coverFiles = book.covers.map(c => c.url);
        const pageFiles = book.chapters.flatMap(ch => ch.pages.map(p => p.path));
        const totalFiles = coverFiles.length + pageFiles.length;

        const deletedChaptersCount = book.chapters.length;
        const deletedPagesCount = book.chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
        const deletedCoversCount = book.covers.length;

        try {
            await this.bookRepository.softRemove(book);

            this.eventEmitter.emit('book.deleted', {
                bookId: book.id,
                bookTitle: book.title,
                covers: coverFiles,
                pages: pageFiles,
            });

            this.logger.log(`Book deleted successfully: ${book.title}`);

            return {
                deletedBooks: 1,
                deletedChapters: deletedChaptersCount,
                deletedPages: deletedPagesCount,
                deletedCovers: deletedCoversCount,
                filesScheduledForDeletion: totalFiles,
                success: true,
            };
        } catch (error) {
            this.logger.error(`Error deleting book ${bookId}:`, error);
            return {
                filesScheduledForDeletion: 0,
                success: false,
                errors: [error.message],
            };
        }
    }

    async deleteBooks(bookIds: string[]): Promise<DeletionResult> {
        this.logger.log(`Deleting ${bookIds.length} books in batch`);

        if (bookIds.length === 0) {
            throw new BadRequestException('No book IDs provided');
        }

        if (bookIds.length > 100) {
            throw new BadRequestException('Maximum 100 books per batch deletion');
        }

        const books = await this.bookRepository.find({
            where: { id: In(bookIds) },
            relations: ['chapters', 'chapters.pages', 'covers'],
        });

        if (books.length === 0) {
            throw new NotFoundException('No books found with provided IDs');
        }

        let totalFiles = 0;
        let totalChapters = 0;
        let totalPages = 0;
        let totalCovers = 0;
        const errors: string[] = [];

        for (const book of books) {
            const coverFiles = book.covers.map(c => c.url);
            const pageFiles = book.chapters.flatMap(ch => ch.pages.map(p => p.path));

            totalFiles += coverFiles.length + pageFiles.length;
            totalChapters += book.chapters.length;
            totalPages += book.chapters.reduce((sum, ch) => sum + ch.pages.length, 0);
            totalCovers += book.covers.length;

            try {
                await this.bookRepository.softRemove(book);

                this.eventEmitter.emit('book.deleted', {
                    bookId: book.id,
                    bookTitle: book.title,
                    covers: coverFiles,
                    pages: pageFiles,
                });
            } catch (error) {
                this.logger.error(`Error deleting book ${book.id}:`, error);
                errors.push(`Book ${book.id}: ${error.message}`);
            }
        }

        this.logger.log(`Batch deletion completed: ${books.length} books`);

        return {
            deletedBooks: books.length,
            deletedChapters: totalChapters,
            deletedPages: totalPages,
            deletedCovers: totalCovers,
            filesScheduledForDeletion: totalFiles,
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    async deleteChapter(chapterId: string): Promise<DeletionResult> {
        this.logger.log(`Deleting chapter: ${chapterId}`);

        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
            relations: ['pages', 'book'],
        });

        if (!chapter) {
            throw new NotFoundException(`Chapter with id ${chapterId} not found`);
        }

        const pageFiles = chapter.pages.map(p => p.path);
        const totalFiles = pageFiles.length;

        try {
            await this.chapterRepository.softRemove(chapter);

            this.eventEmitter.emit('chapter.deleted', {
                chapterId: chapter.id,
                bookId: chapter.book?.id,
                pages: pageFiles,
            });

            this.logger.log(`Chapter deleted successfully: ${chapterId}`);

            return {
                deletedChapters: 1,
                deletedPages: chapter.pages.length,
                filesScheduledForDeletion: totalFiles,
                success: true,
            };
        } catch (error) {
            this.logger.error(`Error deleting chapter ${chapterId}:`, error);
            return {
                filesScheduledForDeletion: 0,
                success: false,
                errors: [error.message],
            };
        }
    }

    async deleteChapters(chapterIds: string[]): Promise<DeletionResult> {
        this.logger.log(`Deleting ${chapterIds.length} chapters in batch`);

        if (chapterIds.length === 0) {
            throw new BadRequestException('No chapter IDs provided');
        }

        if (chapterIds.length > 100) {
            throw new BadRequestException('Maximum 100 chapters per batch deletion');
        }

        const chapters = await this.chapterRepository.find({
            where: { id: In(chapterIds) },
            relations: ['pages', 'book'],
        });

        if (chapters.length === 0) {
            throw new NotFoundException('No chapters found with provided IDs');
        }

        let totalFiles = 0;
        let totalPages = 0;
        const errors: string[] = [];

        for (const chapter of chapters) {
            const pageFiles = chapter.pages.map(p => p.path);
            totalFiles += pageFiles.length;
            totalPages += chapter.pages.length;

            try {
                await this.chapterRepository.softRemove(chapter);

                this.eventEmitter.emit('chapter.deleted', {
                    chapterId: chapter.id,
                    bookId: chapter.book?.id,
                    pages: pageFiles,
                });
            } catch (error) {
                this.logger.error(`Error deleting chapter ${chapter.id}:`, error);
                errors.push(`Chapter ${chapter.id}: ${error.message}`);
            }
        }

        this.logger.log(`Batch deletion completed: ${chapters.length} chapters`);

        return {
            deletedChapters: chapters.length,
            deletedPages: totalPages,
            filesScheduledForDeletion: totalFiles,
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    async deleteCover(coverId: string): Promise<void> {
        this.logger.log(`Deleting cover: ${coverId}`);

        const cover = await this.coverRepository.findOne({
            where: { id: coverId },
        });

        if (!cover) {
            throw new NotFoundException(`Cover with id ${coverId} not found`);
        }

        await this.coverRepository.softRemove(cover);

        this.eventEmitter.emit('cover.deleted', {
            coverId: cover.id,
            url: cover.url,
        });

        this.logger.log(`Cover deleted successfully: ${coverId}`);
    }

    async deleteCovers(coverIds: string[]): Promise<DeletionResult> {
        this.logger.log(`Deleting ${coverIds.length} covers in batch`);

        if (coverIds.length === 0) {
            throw new BadRequestException('No cover IDs provided');
        }

        const covers = await this.coverRepository.find({
            where: { id: In(coverIds) },
        });

        if (covers.length === 0) {
            throw new NotFoundException('No covers found with provided IDs');
        }

        const errors: string[] = [];

        for (const cover of covers) {
            try {
                await this.coverRepository.softRemove(cover);

                this.eventEmitter.emit('cover.deleted', {
                    coverId: cover.id,
                    url: cover.url,
                });
            } catch (error) {
                this.logger.error(`Error deleting cover ${cover.id}:`, error);
                errors.push(`Cover ${cover.id}: ${error.message}`);
            }
        }

        return {
            deletedCovers: covers.length,
            filesScheduledForDeletion: covers.length,
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    async deletePages(chapterId: string, pageIndices: number[]): Promise<void> {
        this.logger.log(`Deleting pages from chapter: ${chapterId}`);

        if (pageIndices.length === 0) {
            throw new BadRequestException('No page indices provided');
        }

        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
            relations: ['pages'],
        });

        if (!chapter) {
            throw new NotFoundException(`Chapter with id ${chapterId} not found`);
        }

        const pagesToDelete = chapter.pages.filter(p => pageIndices.includes(p.index));

        if (pagesToDelete.length === 0) {
            throw new NotFoundException('No pages found with provided indices');
        }

        await this.pageRepository.softRemove(pagesToDelete);

        for (const page of pagesToDelete) {
            this.eventEmitter.emit('page.deleted', {
                pageId: page.id,
                chapterId: chapter.id,
                path: page.path,
            });
        }

        this.logger.log(`${pagesToDelete.length} pages deleted successfully`);
    }

    async listDeletedBooks(): Promise<any[]> {
        const books = await this.bookRepository.find({
            where: {},
            withDeleted: true,
            relations: ['chapters', 'chapters.pages', 'covers'],
        });

        return books
            .filter(book => book.deletedAt !== null)
            .map(book => {
                const coverCount = book.covers.filter(c => c.deletedAt !== null).length;
                const chapterCount = book.chapters.filter(ch => ch.deletedAt !== null).length;
                const pageCount = book.chapters
                    .flatMap(ch => ch.pages)
                    .filter(p => p.deletedAt !== null).length;

                return {
                    id: book.id,
                    title: book.title,
                    deletedAt: book.deletedAt,
                    chaptersCount: chapterCount,
                    pagesCount: pageCount,
                    coversCount: coverCount,
                    totalFiles: coverCount + pageCount,
                };
            });
    }

    async listDeletedChapters(): Promise<any[]> {
        const chapters = await this.chapterRepository.find({
            where: {},
            withDeleted: true,
            relations: ['pages', 'book'],
        });

        return chapters
            .filter(ch => ch.deletedAt !== null)
            .map(chapter => {
                const pageCount = chapter.pages.filter(p => p.deletedAt !== null).length;

                return {
                    id: chapter.id,
                    title: chapter.title,
                    bookId: chapter.book?.id,
                    bookTitle: chapter.book?.title,
                    deletedAt: chapter.deletedAt,
                    pagesCount: pageCount,
                };
            });
    }

    async listDeletedCovers(): Promise<any[]> {
        const covers = await this.coverRepository.find({
            where: {},
            withDeleted: true,
            relations: ['book'],
        });

        return covers
            .filter(c => c.deletedAt !== null)
            .map(cover => ({
                id: cover.id,
                title: cover.title,
                url: cover.url,
                bookId: cover.book?.id,
                bookTitle: cover.book?.title,
                deletedAt: cover.deletedAt,
            }));
    }

    async listDeletedPages(): Promise<any[]> {
        const pages = await this.pageRepository.find({
            where: {},
            withDeleted: true,
            relations: ['chapter', 'chapter.book'],
        });

        return pages
            .filter(p => p.deletedAt !== null)
            .map(page => ({
                id: page.id,
                index: page.index,
                path: page.path,
                chapterId: page.chapter?.id,
                chapterTitle: page.chapter?.title,
                bookId: page.chapter?.book?.id,
                bookTitle: page.chapter?.book?.title,
                deletedAt: page.deletedAt,
            }));
    }
}
