import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UrlImageDto } from '../dto/url-image.dto';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Injectable()
export class CoverImageService {
    private readonly logger = new Logger(CoverImageService.name);

    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly coverImageQueue: Queue<QueueCoverProcessorDto>,
    ) {}

    public async addCoverToQueue(bookId: string, urlOrigin: string, covers: UrlImageDto[]): Promise<void> {
        const existingJobs = await this.coverImageQueue.getJobs(['waiting', 'delayed', 'active']);
        const isAlreadyQueued = existingJobs.some(job => job && job.data.bookId === bookId);
        if (!isAlreadyQueued) {
            this.logger.debug(`Adicionando job de capa para o livro: ${bookId}`);
            for (const cover of covers) {
                await this.coverImageQueue.add(JOB_NAME, { bookId, urlOrigin, cover });
            }
        } else {
            this.logger.debug(`Job de capa para o livro ${bookId} já está na fila.`);
        }
    }
}
