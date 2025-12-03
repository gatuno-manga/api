import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Chapter } from "../entitys/chapter.entity";
import { Not, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

const QUEUE_NAME = 'chapter-scraping';
const JOB_NAME = 'process-chapter';

@Injectable()
export class ChapterScrapingService {
    private readonly logger = new Logger(ChapterScrapingService.name);

    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly chapterScrapingQueue: Queue<string>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
    ) {}

    /**
     * Adiciona um capítulo à fila de scraping.
     * Usa jobId único para deduplicação eficiente O(1).
     */
    public async addChapterToQueue(chapterId: string): Promise<void> {
        const jobId = `chapter-scraping-${chapterId}`;

        try {
            await this.chapterScrapingQueue.add(JOB_NAME, chapterId, { jobId });
            this.logger.debug(`Adicionando job para o capítulo: ${chapterId}`);
        } catch (error) {
            // Job com mesmo ID já existe na fila
            if (error.message?.includes('Job with this id already exists')) {
                this.logger.debug(`Job para o capítulo ${chapterId} já está na fila.`);
            } else {
                throw error;
            }
        }
    }

    public async scheduleAllPendingChapters(): Promise<void> {
        this.logger.log('Buscando todos os capítulos pendentes para enfileirar...');

        const pendingChapters = await this.chapterRepository.find({
            where: { scrapingStatus: Not(ScrapingStatus.READY) },
            select: ['id'],
        });

        for (const chapter of pendingChapters) {
            await this.addChapterToQueue(chapter.id);
        }

        this.logger.log(`${pendingChapters.length} capítulos pendentes foram adicionados à fila.`);
    }
}
