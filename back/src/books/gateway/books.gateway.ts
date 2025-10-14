import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';

/**
 * Gateway WebSocket para comunicação em tempo real de eventos de livros
 * Implementa o padrão Observer para notificar clientes sobre mudanças
 */
@WebSocketGateway({
    cors: {
        origin: process.env.ALLOWED_URL?.split(',') || ['http://localhost:4200', 'http://gatuno.barbosa.local'],
        credentials: true,
    },
    namespace: '/books',
    transports: ['websocket', 'polling'], // Adiciona polling como fallback
})
export class BooksGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(BooksGateway.name);

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway initialized on namespace /books');
        this.logger.log(`CORS origin: ${process.env.ALLOWED_URL || 'localhost:4200'}`);
    }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id} from ${client.handshake.address}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    // ==================== EVENTOS DE LIVROS ====================

    /**
     * Notifica quando um livro é criado
     */
    @OnEvent('book.created')
    handleBookCreated(book: Book) {
        this.logger.debug(`Broadcasting book.created event for book ${book.id}`);
        this.server.emit('book.created', {
            id: book.id,
            title: book.title,
            type: book.type,
            createdAt: book.createdAt,
        });
    }

    /**
     * Notifica quando um livro é atualizado
     */
    @OnEvent('book.updated')
    handleBookUpdated(book: Book) {
        this.logger.debug(`Broadcasting book.updated event for book ${book.id}`);
        this.server.emit('book.updated', {
            id: book.id,
            title: book.title,
            updatedAt: book.updatedAt,
        });
    }

    // ==================== EVENTOS DE CAPÍTULOS ====================

    /**
     * Notifica quando capítulos são atualizados
     */
    @OnEvent('chapters.updated')
    handleChaptersUpdated(payload: Chapter | Chapter[]) {
        // Normaliza para sempre trabalhar com array
        const chapters = Array.isArray(payload) ? payload : [payload];

        if (!chapters || chapters.length === 0) return;

        const bookId = chapters[0]?.book?.id;
        this.logger.debug(
            `Broadcasting chapters.updated event for ${chapters.length} chapters`,
        );

        this.server.emit('chapters.updated', {
            bookId,
            chapters: chapters.map((ch) => ({
                id: ch.id,
                title: ch.title,
                index: ch.index,
                scrapingStatus: ch.scrapingStatus,
            })),
        });
    }

    /**
     * Notifica quando capítulos precisam ser corrigidos
     */
    @OnEvent('chapters.fix')
    handleChaptersFix(chapters: Chapter[]) {
        if (!chapters || chapters.length === 0) return;

        const bookId = chapters[0]?.book?.id;
        this.logger.debug(`Broadcasting chapters.fix event for ${chapters.length} chapters`);

        this.server.emit('chapters.fix', {
            bookId,
            chapterIds: chapters.map((ch) => ch.id),
        });
    }

    // ==================== EVENTOS DE SCRAPING ====================

    /**
     * Notifica quando um capítulo inicia scraping
     */
    @OnEvent('chapter.scraping.started')
    handleChapterScrapingStarted(data: { chapterId: string; bookId: string }) {
        this.logger.debug(`Broadcasting chapter.scraping.started for chapter ${data.chapterId}`);
        this.server.emit('chapter.scraping.started', data);
    }

    /**
     * Notifica quando um capítulo completa scraping
     */
    @OnEvent('chapter.scraping.completed')
    handleChapterScrapingCompleted(data: {
        chapterId: string;
        bookId: string;
        pagesCount: number;
    }) {
        this.logger.debug(
            `Broadcasting chapter.scraping.completed for chapter ${data.chapterId}`,
        );
        this.server.emit('chapter.scraping.completed', data);
    }

    /**
     * Notifica quando um capítulo falha no scraping
     */
    @OnEvent('chapter.scraping.failed')
    handleChapterScrapingFailed(data: { chapterId: string; bookId: string; error: string }) {
        this.logger.debug(`Broadcasting chapter.scraping.failed for chapter ${data.chapterId}`);
        this.server.emit('chapter.scraping.failed', data);
    }

    // ==================== EVENTOS DE CAPA ====================

    /**
     * Notifica quando uma capa é processada
     */
    @OnEvent('cover.processed')
    handleCoverProcessed(data: { bookId: string; coverId: string; url: string }) {
        this.logger.debug(`Broadcasting cover.processed for book ${data.bookId}`);
        this.server.emit('cover.processed', data);
    }

    /**
     * Notifica quando uma capa é selecionada
     */
    @OnEvent('cover.selected')
    handleCoverSelected(data: { bookId: string; coverId: string }) {
        this.logger.debug(`Broadcasting cover.selected for book ${data.bookId}`);
        this.server.emit('cover.selected', data);
    }
}
