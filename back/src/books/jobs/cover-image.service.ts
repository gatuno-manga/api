import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Injectable()
export class CoverImageService {
    private readonly logger = new Logger(CoverImageService.name);

    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly coverImageQueue: Queue<any>,
    ) {}

    public async addCoverToQueue(bookId: string, urlOrigin: string, urlImg: string): Promise<void> {
        const existingJobs = await this.coverImageQueue.getJobs(['waiting', 'delayed', 'active']);
        const isAlreadyQueued = existingJobs.some(job => job && job.data.bookId === bookId);
        if (!isAlreadyQueued) {
            this.logger.debug(`Adicionando job de capa para o livro: ${bookId}`);
            await this.coverImageQueue.add(JOB_NAME, { bookId, urlOrigin, urlImg });
        } else {
            this.logger.debug(`Job de capa para o livro ${bookId} já está na fila.`);
        }
    }
}
