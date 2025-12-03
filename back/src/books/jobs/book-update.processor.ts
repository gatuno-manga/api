import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { ScrapingService } from 'src/scraping/scraping.service';
import { AppConfigService } from 'src/app-config/app-config.service';
import { ScrapingStatus } from '../enum/scrapingStatus.enum';

const QUEUE_NAME = 'book-update-queue';

interface BookUpdateJobData {
    bookId: string;
}

interface ScrapedChapter {
    title: string;
    url: string;
    index: number;
}

@Processor(QUEUE_NAME)
export class BookUpdateProcessor extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(BookUpdateProcessor.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        @InjectRepository(Chapter)
        private readonly chapterRepository: Repository<Chapter>,
        private readonly scrapingService: ScrapingService,
        private readonly configService: AppConfigService,
        private readonly eventEmitter: EventEmitter2,
    ) {
        super();
    }

    onModuleInit() {
        // Usa concorrência baixa para não sobrecarregar
        this.worker.concurrency = this.configService.queueConcurrency?.bookUpdate ?? 2;
    }

    async process(job: Job<BookUpdateJobData>): Promise<{ newChapters: number }> {
        const { bookId } = job.data;
        this.logger.debug(`Processing book update for: ${bookId}`);

        const book = await this.bookRepository.findOne({
            where: { id: bookId },
            relations: ['chapters'],
        });

        if (!book) {
            this.logger.warn(`Book ${bookId} not found`);
            throw new Error(`Book ${bookId} not found`);
        }

        if (!book.originalUrl || book.originalUrl.length === 0) {
            this.logger.warn(`Book ${book.title} has no original URL`);
            return { newChapters: 0 };
        }

        // Pega a primeira URL original (página principal do livro)
        const bookUrl = book.originalUrl[0];

        try {
            // Faz scraping da lista de capítulos
            const scrapedChapters = await this.scrapingService.scrapeChapterList(bookUrl);

            if (scrapedChapters.length === 0) {
                this.logger.debug(`No chapters found for book: ${book.title}`);
                return { newChapters: 0 };
            }

            // Encontra capítulos novos comparando URLs
            const existingUrls = new Set(book.chapters.map(ch => ch.originalUrl));
            const newChapters = scrapedChapters.filter(ch => !existingUrls.has(ch.url));

            if (newChapters.length === 0) {
                this.logger.debug(`No new chapters for book: ${book.title}`);
                return { newChapters: 0 };
            }

            this.logger.log(`Found ${newChapters.length} new chapters for book: ${book.title}`);

            // Calcula o próximo índice baseado nos capítulos existentes
            const maxExistingIndex = book.chapters.length > 0
                ? Math.max(...book.chapters.map(ch => ch.index))
                : 0;

            // Cria os novos capítulos
            const createdChapters: Chapter[] = [];
            for (let i = 0; i < newChapters.length; i++) {
                const scraped = newChapters[i];
                const chapter = this.chapterRepository.create({
                    title: scraped.title,
                    originalUrl: scraped.url,
                    index: scraped.index || (maxExistingIndex + i + 1),
                    book: book,
                    scrapingStatus: ScrapingStatus.PROCESS,
                });
                const saved = await this.chapterRepository.save(chapter);
                createdChapters.push(saved);
            }

            // Emite evento para processar os novos capítulos
            this.eventEmitter.emit('chapters.updated', createdChapters);

            // Emite evento de novos capítulos encontrados
            this.eventEmitter.emit('book.new-chapters', {
                bookId: book.id,
                newChaptersCount: createdChapters.length,
                chapters: createdChapters.map(ch => ({
                    id: ch.id,
                    title: ch.title,
                    index: ch.index,
                })),
            });

            this.logger.log(`Added ${createdChapters.length} new chapters to book: ${book.title}`);
            return { newChapters: createdChapters.length };
        } catch (error) {
            this.logger.error(`Error updating book ${book.title}: ${error.message}`);
            throw error;
        }
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job<BookUpdateJobData>): Promise<void> {
        this.logger.error(
            `Book update job ${job.id} failed for book ${job.data.bookId}: ${job.failedReason}`,
        );
    }

    @OnWorkerEvent('completed')
    async onCompleted(job: Job<BookUpdateJobData>): Promise<void> {
        const result = job.returnvalue as { newChapters: number };
        if (result?.newChapters > 0) {
            this.logger.log(
                `Book update job ${job.id} completed. Added ${result.newChapters} new chapters to book ${job.data.bookId}`,
            );
        }
    }
}
