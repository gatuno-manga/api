import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from '../entitys/book.entity';
import { Repository } from 'typeorm';
import { ScrapingService } from 'src/scraping/scraping.service';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Processor(QUEUE_NAME)
export class CoverImageProcessor extends WorkerHost {
    private readonly logger = new Logger(CoverImageProcessor.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly scrapingService: ScrapingService,
    ) {
        super();
    }

    async process(job: Job<any>): Promise<void> {
        const { bookId, urlOrigin, urlImg } = job.data;
        this.logger.debug(`Processando capa para o livro: ${bookId}`);
        const book = await this.bookRepository.findOne({ where: { id: bookId } });
        if (!book) {
            this.logger.warn(`Livro com id ${bookId} não encontrado para processar capa.`);
            return;
        }
        try {
            const cover = await this.scrapingService.scrapeSingleImage(urlOrigin, urlImg);
            book.cover = cover;
            await this.bookRepository.save(book);
            this.logger.log(`Capa salva para o livro: ${book.title}`);
        } catch (err) {
            this.logger.warn(`Falha ao baixar capa para o livro: ${book.title}`, err);
        }
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<any>) {
        this.logger.error(`Job de capa com id ${job.id} FAILED!`, job.failedReason);
    }
}
