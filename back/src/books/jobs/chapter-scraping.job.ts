import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Page } from "../entitys/page.entity";
import { Chapter } from "../entitys/chapter.entity";
import { DataSource, Repository } from "typeorm";
import { ScrapingStatus } from '../enum/scrapingStatus.enum';
import { ScrapingService } from 'src/scraping/scraping.service';
import { AppConfigService } from 'src/app-config/app-config.service';

const QUEUE_NAME = 'chapter-scraping';
const JOB_NAME = 'process-chapter';

@Processor(QUEUE_NAME)
export class ChapterScrapingJob extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(ChapterScrapingJob.name);

    constructor(
        @InjectRepository(Page)
        private readonly pageRepository: Repository<Page>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        private readonly dataSource: DataSource,
        private readonly scrapingService: ScrapingService,
        private readonly configService: AppConfigService,
    ) {
        super();
    }

    onModuleInit() {
        this.worker.concurrency = this.configService.queueConcurrency.chapterScraping;
    }

    async process(job: Job<string>): Promise<void> {
        const chapterId = job.data;
        this.logger.debug(`Iniciando processamento do job: ${job.id} para o capítulo: ${chapterId}`);
        const startTime = Date.now();

        this.logger.debug(`Buscando capítulo com ID: ${chapterId}`);
        const chapter = await this.getChapter(chapterId);

        if (!chapter) {
            this.logger.error(`Capítulo com ID ${chapterId} não encontrado. Job ${job.id} falhará.`);
            throw new Error(`Capítulo com ID ${chapterId} não encontrado.`);
        }

        await this.processSingleChapter(chapter);

        const endTime = Date.now();
        this.logger.debug(`Job ${job.id} finalizado. Tempo total: ${(endTime - startTime) / 1000}s`);
    }

    private async getChapter(chapterId: string) {
        const queryRunner = this.dataSource.createQueryRunner('master');
        await queryRunner.connect();
        const chapter = await queryRunner.manager.findOne(Chapter, {
            where: { id: chapterId },
            relations: ['book', 'pages']
        });
        await queryRunner.release();
        return chapter;
    }

    @OnWorkerEvent('active')
    onActive(job: Job<string>) {
        const chapterId = job.data;
        const queryRunner = this.dataSource.createQueryRunner('master');
        queryRunner.connect().then(() => {
            return queryRunner.manager.findOne(Chapter, { where: { id: chapterId } });
        }).then(chapter => {
            if (chapter) {
                chapter.retries += 1;
                return queryRunner.manager.save(chapter);
            }
        }).catch(error => {
            this.logger.error(`Erro ao incrementar retentativa para o capítulo ${chapterId}: ${error.message}`);
        }).finally(() => {
            queryRunner.release();
        });
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<string>) {
        const chapterId = job.data;
        this.logger.error(`Job with id ${job.id} FAILED! Attempt Number ${job.attemptsMade} for chapter ID: ${chapterId}`);
    }

    private async processSingleChapter(chapter: Chapter): Promise<void> {
        const startTime = Date.now();
        this.logger.debug(`Iniciando scraping para capítulo: ${chapter.book.title} (${chapter.index})`);

        try {
            await this.pageRepository.delete({ chapter: { id: chapter.id } });

            const pages = await this.scrapingService.scrapePages(chapter.originalUrl);
            if (!pages || pages.length === 0) {
                chapter.scrapingStatus = ScrapingStatus.ERROR;
                await this.chapterRepository.save(chapter);
                this.logger.warn(`Nenhuma página encontrada para o capítulo: ${chapter.book.title} (${chapter.index})`);
                return;
            }

            let index = 1;
            const newPages = pages.map((pageContent) =>
                this.pageRepository.create({ path: pageContent, index: index++ })
            );

            chapter.pages = newPages;
            chapter.scrapingStatus = ScrapingStatus.READY;
            await this.chapterRepository.save(chapter);

            const endTime = Date.now();
            this.logger.log(` Páginas salvas para o capítulo: ${chapter.book.title} (${chapter.index}) em ${(endTime - startTime) / 1000}s`);
        } catch (error) {
            this.logger.error(` Falha no scraping do capítulo ${chapter.id}: ${error.message}`, error.stack);
            chapter.scrapingStatus = ScrapingStatus.ERROR;

            throw error;
        }
    }
}
