import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'fix-chapter-queue';
const JOB_NAME = 'fix-chapter';

@Injectable()
export class FixChapterService {
    private readonly logger = new Logger(FixChapterService.name);

    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly fixChapterQueue: Queue<any>,
    ) {}

    public async addChapterToFixQueue(chapterId: string): Promise<void> {
        const existingJobs = await this.fixChapterQueue.getJobs(['waiting', 'delayed', 'active']);
        const isAlreadyQueued = existingJobs.some(job => job && job.data.chapterId === chapterId);
        if (!isAlreadyQueued) {
            this.logger.debug(`Adicionando job de conserto para o capítulo: ${chapterId}`);
            await this.fixChapterQueue.add(JOB_NAME, { chapterId });
        } else {
            this.logger.debug(`Job de conserto para o capítulo ${chapterId} já está na fila.`);
        }
    }
}
