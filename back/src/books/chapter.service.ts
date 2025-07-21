import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chapter } from './entitys/chapter.entity';
import { Repository, In } from 'typeorm';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ScrapingStatus } from './enum/scrapingStatus.enum';
import { ChapterRead } from './entitys/chapter-read.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ChapterService {
    private readonly logger = new Logger(ChapterService.name);
    constructor(
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        @InjectRepository(ChapterRead)
        private readonly chapterReadRepository: Repository<ChapterRead>,
        private readonly appConfig: AppConfigService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private urlImage(url: string): string {
        const appUrl = this.appConfig.apiUrl;
        return `${appUrl}${url}`;
    }

    async getChapter(idChapter: string, userId?: string) {
        const chapter = await this.chapterRepository.findOne({
            where: { id: idChapter },
            relations: ['pages', 'book'],
        });
        if (!chapter) {
            this.logger.warn(
                `Chapter with id ${idChapter} not found`,
            );
            throw new NotFoundException(
                `Chapter with id ${idChapter} not found`,
            );
        }
        const previousChapter = await this.chapterRepository
            .createQueryBuilder('chapter')
            .where('chapter.bookId = :bookId', { bookId: chapter.book.id })
            .andWhere('chapter.index < :currentIndex', { currentIndex: chapter.index })
            .orderBy('chapter.index', 'DESC')
            .select(['chapter.id'])
            .getOne();
        const nextChapter = await this.chapterRepository
            .createQueryBuilder('chapter')
            .where('chapter.bookId = :bookId', { bookId: chapter.book.id })
            .andWhere('chapter.index > :currentIndex', { currentIndex: chapter.index })
            .orderBy('chapter.index', 'ASC')
            .select(['chapter.id'])
            .getOne();
        const maxIndexChapter = await this.chapterRepository
            .createQueryBuilder('chapter')
            .where('chapter.bookId = :bookId', { bookId: chapter.book.id })
            .select('MAX(chapter.index)', 'max')
            .getRawOne();
        const totalChapters = maxIndexChapter?.max ? Number(maxIndexChapter.max) : 0;
        const { book, ...chapterWithoutBook } = chapter;
        if (chapterWithoutBook.pages) {
            for (const page of chapterWithoutBook.pages) {
                page.path = this.urlImage(page.path);
            }
        }
        if (userId) {
            this.markChapterAsRead(idChapter, userId).catch(err => this.logger.error(err));
        }
        return {
            ...chapterWithoutBook,
            previous: previousChapter?.id,
            next: nextChapter?.id,
            bookId: book.id,
            bookTitle: book.title,
            totalChapters,
        };
    }

    async resetChapter(idChapter: string) {
        const chapter = await this.chapterRepository.findOne({
            where: { id: idChapter },
        });
        if (!chapter) {
            throw new NotFoundException(
                `Chapter with id ${idChapter} not found`,
            );
        }
        chapter.scrapingStatus = ScrapingStatus.PROCESS;
        await this.chapterRepository.save(chapter);
        this.eventEmitter.emit('chapters.updated', chapter);
        return chapter;
    }

    async markChapterAsRead(chapterId: string, userId: string) {
        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
        });
        if (!chapter) {
            throw new NotFoundException(`Chapter with id ${chapterId} not found`);
        }
        const chapterRead = this.chapterReadRepository.create({
            chapter,
            user: { id: userId },
        });
        await this.chapterReadRepository.save(chapterRead);
        this.logger.log(`Chapter ${chapterId} marked as read by user ${userId}`);
        return chapterRead;
    }
}
