import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookUpdateJobService } from './book-update.service';
import { AppConfigService } from 'src/app-config/app-config.service';

const CRON_JOB_NAME = 'book-update-cron';

/**
 * Job agendado para verificar atualizações de livros periodicamente.
 * Usa a variável de ambiente BOOK_UPDATE_CRON para configurar o intervalo.
 */
@Injectable()
export class BookUpdateScheduler implements OnModuleInit {
	private readonly logger = new Logger(BookUpdateScheduler.name);

	constructor(
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
		private readonly bookUpdateJobService: BookUpdateJobService,
		private readonly configService: AppConfigService,
		private readonly schedulerRegistry: SchedulerRegistry,
	) {}

	onModuleInit() {
		if (!this.configService.bookUpdate?.enabled) {
			this.logger.log('Book auto-update is disabled');
			return;
		}

		const cronExpression = this.configService.bookUpdate.cronExpression;
		this.logger.log(
			`Registering book update cron job with expression: ${cronExpression}`,
		);

		const job = new CronJob(cronExpression, () => {
			this.handleScheduledUpdate();
		});

		this.schedulerRegistry.addCronJob(CRON_JOB_NAME, job);
		job.start();

		this.logger.log('Book update cron job registered and started');
	}

	/**
	 * Executa a verificação de atualizações.
	 * Apenas livros com URLs originais e autoUpdate habilitado são verificados.
	 */
	async handleScheduledUpdate(): Promise<void> {
		if (!this.configService.bookUpdate?.enabled) {
			this.logger.debug('Book auto-update is disabled');
			return;
		}

		this.logger.log('Starting scheduled book update check...');

		try {
			// Busca livros que possuem URL original, autoUpdate habilitado e não foram deletados
			const books = await this.bookRepository.find({
				where: {
					deletedAt: IsNull(),
					autoUpdate: true,
				},
				select: ['id', 'title', 'originalUrl', 'autoUpdate'],
			});

			// Filtra apenas livros com URL original válida
			const booksWithUrls = books.filter(
				(book) => book.originalUrl && book.originalUrl.length > 0,
			);

			if (booksWithUrls.length === 0) {
				this.logger.debug('No books with autoUpdate enabled to check');
				return;
			}

			this.logger.log(
				`Scheduling update check for ${booksWithUrls.length} books with autoUpdate enabled`,
			);

			// Adiciona todos os livros à fila de atualização
			const bookIds = booksWithUrls.map((book) => book.id);
			await this.bookUpdateJobService.addBooksToUpdateQueue(bookIds);

			this.logger.log(
				`Scheduled ${bookIds.length} books for update check`,
			);
		} catch (error) {
			this.logger.error(
				`Error during scheduled book update: ${error.message}`,
				error.stack,
			);
		}
	}

	/**
	 * Força a verificação de atualização de um livro específico.
	 */
	async forceUpdateBook(bookId: string): Promise<void> {
		await this.bookUpdateJobService.addBookToUpdateQueue(bookId);
		this.logger.log(`Force update scheduled for book: ${bookId}`);
	}

	/**
	 * Força a verificação de atualização de todos os livros.
	 */
	async forceUpdateAllBooks(): Promise<void> {
		await this.handleScheduledUpdate();
	}
}
