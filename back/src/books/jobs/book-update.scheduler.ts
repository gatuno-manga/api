import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Book } from '../entitys/book.entity';
import { BookUpdateJobService } from './book-update.service';
import { AppConfigService } from 'src/app-config/app-config.service';

/**
 * Job agendado para verificar atualizações de livros periodicamente.
 * Executa a cada 6 horas por padrão.
 */
@Injectable()
export class BookUpdateScheduler {
    private readonly logger = new Logger(BookUpdateScheduler.name);

    constructor(
        @InjectRepository(Book)
        private readonly bookRepository: Repository<Book>,
        private readonly bookUpdateJobService: BookUpdateJobService,
        private readonly configService: AppConfigService,
    ) {}

    /**
     * Executa a verificação de atualizações a cada 6 horas.
     * Apenas livros com URLs originais são verificados.
     */
    @Cron(CronExpression.EVERY_6_HOURS)
    async handleScheduledUpdate(): Promise<void> {
        if (!this.configService.bookUpdate?.enabled) {
            this.logger.debug('Book auto-update is disabled');
            return;
        }

        this.logger.log('Starting scheduled book update check...');

        try {
            // Busca livros que possuem URL original e não foram deletados
            const books = await this.bookRepository.find({
                where: {
                    deletedAt: IsNull(),
                },
                select: ['id', 'title', 'originalUrl'],
            });

            // Filtra apenas livros com URL original válida
            const booksWithUrls = books.filter(
                book => book.originalUrl && book.originalUrl.length > 0
            );

            if (booksWithUrls.length === 0) {
                this.logger.debug('No books with original URLs to update');
                return;
            }

            this.logger.log(`Scheduling update check for ${booksWithUrls.length} books`);

            // Adiciona todos os livros à fila de atualização
            const bookIds = booksWithUrls.map(book => book.id);
            await this.bookUpdateJobService.addBooksToUpdateQueue(bookIds);

            this.logger.log(`Scheduled ${bookIds.length} books for update check`);
        } catch (error) {
            this.logger.error(`Error during scheduled book update: ${error.message}`, error.stack);
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
