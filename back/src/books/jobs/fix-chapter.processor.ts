import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { Page } from '../entitys/page.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../entitys/chapter.entity';
import { ScrapingService } from 'src/scraping/scraping.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

const QUEUE_NAME = 'fix-chapter-queue';
const JOB_NAME = 'fix-chapter';

@Processor(QUEUE_NAME, { concurrency: 2 })
export class FixChapterProcessor extends WorkerHost {
    private readonly logger = new Logger(FixChapterProcessor.name);

    constructor(
        @InjectRepository(Page)
        private readonly pageRepository: Repository<Page>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        private readonly scrapingService: ScrapingService,
    ) {
        super();
    }

    async process(job: Job<{ chapterId: string }>): Promise<void> {
        const { chapterId } = job.data;
        this.logger.debug(`Processando conserto para o capítulo: ${chapterId}`);
        const chapter = await this.chapterRepository.findOne({
            where: { id: chapterId },
            relations: ['book', 'pages'],
        });
        if (!chapter) {
            this.logger.warn(`Capítulo com ID ${chapterId} não encontrado.`);
            throw new Error(`Capítulo com ID ${chapterId} não encontrado.`);
        }
        await this.fixChapter(chapter);
        this.logger.log(`Capítulo ${chapterId} processado para conserto.`);
    }

    private async fixChapter(chapter: Chapter): Promise<void> {
        this.logger.debug(`Iniciando conserto para o capítulo: ${chapter.id}`);
        try {
            const pages = await this.scrapingService.scrapePages(chapter.originalUrl, chapter.pages.length);
            if (!pages) return;
            await this.pageRepository.delete({ chapter: { id: chapter.id } });
            let index = 1;
            const newPages = pages.map((pageContent) =>
                this.pageRepository.create({ path: pageContent, index: index++ })
            );
            chapter.pages = newPages;
            chapter.scrapingStatus = ScrapingStatus.READY;
            await this.chapterRepository.save(chapter);
            this.logger.log(`Páginas salvas para o capítulo: ${chapter.book.title} (${chapter.index})`);
        } catch (error) {
            this.logger.error(`Falha no scraping do capítulo ${chapter.id}: ${error.message}`, error.stack);
            chapter.scrapingStatus = ScrapingStatus.ERROR;
            await this.chapterRepository.save(chapter);
            throw error;
        }
    }
}
