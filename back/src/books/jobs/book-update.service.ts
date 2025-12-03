import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const QUEUE_NAME = 'book-update-queue';
const JOB_NAME = 'update-book';

@Injectable()
export class BookUpdateJobService {
    private readonly logger = new Logger(BookUpdateJobService.name);

    constructor(
        @InjectQueue(QUEUE_NAME)
        private readonly bookUpdateQueue: Queue<{ bookId: string }>,
    ) {}

    /**
     * Adiciona um livro à fila de atualização.
     * Usa jobId único para deduplicação.
     */
    async addBookToUpdateQueue(bookId: string): Promise<void> {
        const jobId = `book-update-${bookId}`;

        try {
            await this.bookUpdateQueue.add(JOB_NAME, { bookId }, { jobId });
            this.logger.debug(`Book ${bookId} added to update queue`);
        } catch (error) {
            if (error.message?.includes('Job with this id already exists')) {
                this.logger.debug(`Book ${bookId} is already in update queue`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Adiciona múltiplos livros à fila de atualização
     */
    async addBooksToUpdateQueue(bookIds: string[]): Promise<void> {
        for (const bookId of bookIds) {
            await this.addBookToUpdateQueue(bookId);
        }
        this.logger.log(`Added ${bookIds.length} books to update queue`);
    }
}
