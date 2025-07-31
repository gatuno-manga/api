import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Chapter } from "../entitys/chapter.entity";
import { In, Not, Repository } from "typeorm";
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

    public async addChapterToQueue(chapterId: string): Promise<void> {
        const existingJobs = await this.chapterScrapingQueue.getJobs(['waiting', 'delayed', 'active']);
        const isAlreadyQueued = existingJobs.some(job => job && job.data === chapterId)

        if (!isAlreadyQueued) {
            this.logger.debug(`Adicionando job para o capítulo: ${chapterId}`);
            await this.chapterScrapingQueue.add(JOB_NAME, chapterId);
        } else {
            this.logger.debug(`Job para o capítulo ${chapterId} já está na fila.`);
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
