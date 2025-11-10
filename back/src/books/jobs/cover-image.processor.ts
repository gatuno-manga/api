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
import { EventEmitter2 } from '@nestjs/event-emitter';

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
        private readonly eventEmitter: EventEmitter2,
    ) {
        super();
    }

    onModuleInit() {
        this.worker.concurrency = this.configService.queueConcurrency.coverImage;
    }

    async process(job: Job<QueueCoverProcessorDto>): Promise<void> {
        const { bookId, urlOrigin } = job.data;
        // support both legacy single-cover jobs and new batch jobs
        const covers: { url: string; title?: string }[] = (job.data as any).covers ? (job.data as any).covers : [(job.data as any).cover];
        this.logger.debug(`Processando ${covers.length} capa(s) para o livro: ${bookId}`);

        const book = await this.getBook(bookId);
        if (!book) {
            this.logger.warn(`Livro com id ${bookId} não encontrado para processar capa.`);
            return;
        }

        try {
            // group covers by hostname so we can scrape multiple images from the same site in one driver
            const groups = new Map<string, { covers: typeof covers }>();
            for (const c of covers) {
                try {
                    const host = new URL(c.url).hostname;
                    const g = groups.get(host) ?? { covers: [] };
                    g.covers.push(c);
                    groups.set(host, g);
                } catch (e) {
                    this.logger.warn(`URL inválida para capa: ${c.url}`, e);
                }
            }

            for (const [host, group] of groups) {
                const imageUrls = group.covers.map((c) => c.url);
                try {
                    const savedPaths = await this.scrapingService.scrapeMultipleImages(urlOrigin, imageUrls);
                    // savedPaths are in same order as imageUrls
                    for (let i = 0; i < savedPaths.length; i++) {
                        const saved = savedPaths[i];
                        const original = group.covers[i];
                        if (!saved || saved === 'null') {
                            this.logger.warn(`Falha ao salvar capa ${original.url} para livro ${book.title}`);
                            continue;
                        }
                        const coverBook = this.coverRepository.create({
                            title: original.title || 'Cover Image',
                            url: saved,
                            book: book,
                            selected: book.covers.length === 0 ? true : false,
                        });
                        const savedCover = await this.coverRepository.save(coverBook);
                        this.logger.log(`Capa salva para o livro: ${book.title}`);

                        // Emite evento de capa processada
                        this.eventEmitter.emit('cover.processed', {
                            bookId: book.id,
                            coverId: savedCover.id,
                            url: saved,
                        });
                    }
                } catch (err) {
                    this.logger.warn(`Falha ao baixar capas do host ${host} para o livro: ${book.title}`, err);
                }
            }
        } catch (err) {
            this.logger.warn(`Erro ao processar capas para o livro: ${book.title}`, err);
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
