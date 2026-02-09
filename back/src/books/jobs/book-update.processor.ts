import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { AppConfigService } from 'src/app-config/app-config.service';
import { Repository } from 'typeorm';
import { Book } from '../entities/book.entity';
import { BookContentUpdateService } from '../services/book-content-update.service';
import { CoverImageService } from './cover-image.service';

const QUEUE_NAME = 'book-update-queue';

interface BookUpdateJobData {
	bookId: string;
}

interface BookUpdateResult {
	newChapters: number;
	newCovers: number;
}

@Processor(QUEUE_NAME)
export class BookUpdateProcessor extends WorkerHost implements OnModuleInit {
	private readonly logger = new Logger(BookUpdateProcessor.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly configService: AppConfigService,
		private readonly eventEmitter: EventEmitter2,
		private readonly coverImageService: CoverImageService,
		private readonly bookContentUpdateService: BookContentUpdateService,
	) {
		super();
	}

	async onModuleInit() {
		this.worker.concurrency =
			this.configService.queueConcurrency?.bookUpdate ?? 2;

		await this.coverImageService.recalculateMissingCoverHashes();
	}

	@OnWorkerEvent('active')
	async onActive(job: Job<BookUpdateJobData>) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.started', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				timestamp: Date.now(),
			});
			this.logger.debug(`Update started for book: ${book.title}`);
		}
	}

	@OnWorkerEvent('completed')
	async onCompleted(job: Job<BookUpdateJobData>, result: BookUpdateResult) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.completed', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				newChapters: result.newChapters,
				newCovers: result.newCovers,
				timestamp: Date.now(),
			});
			this.logger.debug(
				`Update completed for book: ${book.title} (${result.newChapters} new chapters, ${result.newCovers} new covers)`,
			);
		}
	}

	@OnWorkerEvent('failed')
	async onFailed(job: Job<BookUpdateJobData>, error: Error) {
		const book = await this.bookRepository.findOne({
			where: { id: job.data.bookId },
			select: ['id', 'title'],
		});

		if (book) {
			this.eventEmitter.emit('book.update.failed', {
				bookId: book.id,
				bookTitle: book.title,
				jobId: job.id,
				error: error.message,
				timestamp: Date.now(),
			});
			this.logger.error(
				`Update failed for book: ${book.title}`,
				error.stack,
			);
		}
	}

	async process(job: Job<BookUpdateJobData>): Promise<BookUpdateResult> {
		const { bookId } = job.data;
		const result =
			await this.bookContentUpdateService.performUpdate(bookId);
		return result;
	}
}
