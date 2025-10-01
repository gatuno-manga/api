import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Book } from '../entitys/book.entity';
import { DataSource, Repository } from 'typeorm';
import { ScrapingService } from 'src/scraping/scraping.service';
import { QueueCoverProcessorDto } from '../dto/queue-cover-processor.dto';
import { Cover } from '../entitys/cover.entity';
import { AppConfigService } from 'src/app-config/app-config.service';

const QUEUE_NAME = 'cover-image-queue';
const JOB_NAME = 'process-cover';

@Processor(QUEUE_NAME)
export class CoverImageProcessor extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(CoverImageProcessor.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        @InjectRepository(Cover)
        private readonly coverRepository: Repository<Cover>,
        private readonly scrapingService: ScrapingService,
        private readonly dataSource: DataSource,
        private readonly configService: AppConfigService,
    ) {
        super();
    }

    onModuleInit() {
        this.worker.concurrency = this.configService.queueConcurrency.coverImage;
    }

    async process(job: Job<QueueCoverProcessorDto>): Promise<void> {
        const { bookId, urlOrigin, cover } = job.data;
        this.logger.debug(`Processando capa para o livro: ${bookId}`);

        const book = await this.getBook(bookId);
        if (!book) {
            this.logger.warn(`Livro com id ${bookId} não encontrado para processar capa.`);
            return;
        }
        try {
            const ImageCover = await this.scrapingService.scrapeSingleImage(urlOrigin, cover.url);
            const coverBook = this.coverRepository.create(
                {
                    title: cover.title || 'Cover Image',
                    url: ImageCover,
                    book: book,
                    selected: book.covers.length === 0 ? true : false,
                }
            )
            await this.coverRepository.save(coverBook);
            this.logger.log(`Capa salva para o livro: ${book.title}`);
        } catch (err) {
            this.logger.warn(`Falha ao baixar capa para o livro: ${book.title}`, err);
        }
    }

    private async getBook(bookId: string) {
        const queryRunner = this.dataSource.createQueryRunner('master');
        await queryRunner.connect();
        const book = await queryRunner.manager.findOne(Book, {
            where: { id: bookId },
            relations: ['covers']
        });
        await queryRunner.release();
        return book;
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<QueueCoverProcessorDto>) {
        this.logger.error(`Job de capa com id ${job.id} FAILED!`, job.failedReason);
    }
}
