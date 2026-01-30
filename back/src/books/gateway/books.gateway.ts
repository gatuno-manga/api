import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayInit,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	MessageBody,
	ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { WsJwtGuard } from '../../auth/guard/ws-jwt.guard';
import { RolesEnum } from '../../users/enum/roles.enum';
import { BookEvents } from '../constants/events.constant';

/**
 * Gateway WebSocket para comunicação em tempo real de eventos de livros
 * Implementa o padrão Observer para notificar clientes sobre mudanças
 */
@UseGuards(WsJwtGuard)
@WebSocketGateway({
	cors: {
		origin: process.env.ALLOWED_URL?.split(',') || [
			'http://localhost:4200',
			'http://gatuno.barbosa.local',
		],
		credentials: true,
	},
	namespace: '/books',
	transports: ['websocket', 'polling'],
})
export class BooksGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	private readonly logger = new Logger(BooksGateway.name);
	private connectedClients = new Map<
		string,
		{ bookIds: Set<string>; chapterIds: Set<string>; isAdmin: boolean }
	>();

	afterInit(server: Server) {
		this.logger.log('WebSocket Gateway initialized on namespace /books');
		this.logger.log(
			`CORS origin: ${process.env.ALLOWED_URL || 'localhost:4200'}`,
		);
	}

	handleConnection(client: Socket) {
		try {
			const user = client.data.user;
			const isAdmin = user?.roles?.includes(RolesEnum.ADMIN) || false;

			this.logger.log(
				`Client connected: ${client.id} from ${client.handshake.address} (Admin: ${isAdmin})`,
			);

			// Inicializa tracking do cliente
			this.connectedClients.set(client.id, {
				bookIds: new Set(),
				chapterIds: new Set(),
				isAdmin,
			});

			// Se for admin, adiciona à room admin
			if (isAdmin) {
				client.join('admin');
				this.logger.debug(`Admin ${client.id} joined admin room`);
			}
		} catch (error) {
			this.logger.error(`Error in handleConnection: ${error.message}`);
			client.disconnect();
		}
	}

	handleDisconnect(client: Socket) {
		try {
			const clientData = this.connectedClients.get(client.id);
			this.logger.log(
				`Client disconnected: ${client.id} (Books: ${clientData?.bookIds.size || 0}, Chapters: ${clientData?.chapterIds.size || 0})`,
			);
			this.connectedClients.delete(client.id);
		} catch (error) {
			this.logger.error(`Error in handleDisconnect: ${error.message}`);
		}
	}

	/**
	 * Helper para broadcasting seguro de eventos
	 */
	private broadcast(rooms: string | string[], event: string, payload: any) {
		try {
			const roomList = Array.isArray(rooms) ? rooms : [rooms];
			this.logger.debug(
				`Broadcasting ${event} to rooms: ${roomList.join(', ')}`,
			);
			
			const emitter = this.server;
			roomList.forEach(room => emitter.to(room));
			emitter.emit(event, payload);

			// Note: Socket.io chaining .to().to().emit() sends to all combined.
			// Iterating and emitting might duplicate if not careful, but server.to(r1).to(r2).emit() works.
			// Let's use the chain correctly.
			let broadcastOperator: any = this.server;
			for (const room of roomList) {
				broadcastOperator = broadcastOperator.to(room);
			}
			broadcastOperator.emit(event, payload);

		} catch (error) {
			this.logger.error(`Failed to broadcast ${event}: ${error.message}`);
		}
	}

	// ==================== EVENTOS DE INSCRIÇÃO ====================

	@SubscribeMessage(BookEvents.SUBSCRIBE_BOOK)
	handleSubscribeBook(
		@ConnectedSocket() client: Socket,
		@MessageBody() bookId: string,
	) {
		try {
			if (!bookId || typeof bookId !== 'string') {
				client.emit('error', { message: 'Invalid bookId' });
				return;
			}

			client.join(`book:${bookId}`);
			this.connectedClients.get(client.id)?.bookIds.add(bookId);

			this.logger.debug(
				`Client ${client.id} subscribed to book:${bookId}`,
			);
			client.emit('subscribed', {
				type: 'book',
				id: bookId,
				success: true,
			});
		} catch (error) {
			this.logger.error(
				`Failed to subscribe client ${client.id} to book ${bookId}: ${error.message}`,
			);
			client.emit('subscribed', {
				type: 'book',
				id: bookId,
				success: false,
				error: error.message,
			});
		}
	}

	@SubscribeMessage(BookEvents.SUBSCRIBE_CHAPTER)
	handleSubscribeChapter(
		@ConnectedSocket() client: Socket,
		@MessageBody() chapterId: string,
	) {
		try {
			if (!chapterId || typeof chapterId !== 'string') {
				client.emit('error', { message: 'Invalid chapterId' });
				return;
			}

			client.join(`chapter:${chapterId}`);
			this.connectedClients.get(client.id)?.chapterIds.add(chapterId);

			this.logger.debug(
				`Client ${client.id} subscribed to chapter:${chapterId}`,
			);
			client.emit('subscribed', {
				type: 'chapter',
				id: chapterId,
				success: true,
			});
		} catch (error) {
			this.logger.error(
				`Failed to subscribe client ${client.id} to chapter ${chapterId}: ${error.message}`,
			);
			client.emit('subscribed', {
				type: 'chapter',
				id: chapterId,
				success: false,
				error: error.message,
			});
		}
	}

	@SubscribeMessage(BookEvents.UNSUBSCRIBE_BOOK)
	handleUnsubscribeBook(
		@ConnectedSocket() client: Socket,
		@MessageBody() bookId: string,
	) {
		try {
			client.leave(`book:${bookId}`);
			this.connectedClients.get(client.id)?.bookIds.delete(bookId);

			this.logger.debug(
				`Client ${client.id} unsubscribed from book:${bookId}`,
			);
			client.emit('unsubscribed', {
				type: 'book',
				id: bookId,
				success: true,
			});
		} catch (error) {
			this.logger.error(
				`Failed to unsubscribe client ${client.id} from book ${bookId}: ${error.message}`,
			);
		}
	}

	@SubscribeMessage(BookEvents.UNSUBSCRIBE_CHAPTER)
	handleUnsubscribeChapter(
		@ConnectedSocket() client: Socket,
		@MessageBody() chapterId: string,
	) {
		try {
			client.leave(`chapter:${chapterId}`);
			this.connectedClients.get(client.id)?.chapterIds.delete(chapterId);

			this.logger.debug(
				`Client ${client.id} unsubscribed from chapter:${chapterId}`,
			);
			client.emit('unsubscribed', {
				type: 'chapter',
				id: chapterId,
				success: true,
			});
		} catch (error) {
			this.logger.error(
				`Failed to unsubscribe client ${client.id} from chapter ${chapterId}: ${error.message}`,
			);
		}
	}

	@SubscribeMessage(BookEvents.LIST_SUBSCRIPTIONS)
	handleListSubscriptions(@ConnectedSocket() client: Socket) {
		try {
			const clientData = this.connectedClients.get(client.id);
			client.emit('subscriptions', {
				books: Array.from(clientData?.bookIds || []),
				chapters: Array.from(clientData?.chapterIds || []),
				isAdmin: clientData?.isAdmin || false,
			});
		} catch (error) {
			this.logger.error(
				`Failed to list subscriptions for client ${client.id}: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE LIVROS ====================

	@OnEvent(BookEvents.CREATED)
	handleBookCreated(book: Book) {
		// Apenas admins recebem eventos de criação
		this.broadcast('admin', BookEvents.CREATED, {
			id: book.id,
			title: book.title,
			type: book.type,
			createdAt: book.createdAt,
		});
	}

	@OnEvent(BookEvents.UPDATED)
	handleBookUpdated(book: Book) {
		// Envia para room específica do livro
		this.broadcast(`book:${book.id}`, BookEvents.UPDATED, {
			id: book.id,
			title: book.title,
			updatedAt: book.updatedAt,
		});
	}

	// ==================== EVENTOS DE CAPÍTULOS ====================

	@OnEvent(BookEvents.CHAPTERS_UPDATED)
	handleChaptersUpdated(payload: Chapter | Chapter[]) {
		// Normaliza para sempre trabalhar com array
		const chapters = Array.isArray(payload) ? payload : [payload];

		if (!chapters || chapters.length === 0) return;

		const bookId = chapters[0]?.book?.id;
		
		const chapterData = chapters.map((ch) => ({
			id: ch.id,
			title: ch.title,
			index: ch.index,
			scrapingStatus: ch.scrapingStatus,
		}));

		// Envia para room do livro e admins
		this.broadcast([`book:${bookId}`, 'admin'], BookEvents.CHAPTERS_UPDATED, {
			bookId,
			chapters: chapterData,
		});

		// Envia para rooms específicas de cada capítulo
		chapters.forEach((chapter) => {
			this.broadcast(`chapter:${chapter.id}`, BookEvents.CHAPTER_UPDATED, {
				bookId,
				chapter: {
					id: chapter.id,
					title: chapter.title,
					index: chapter.index,
					scrapingStatus: chapter.scrapingStatus,
				},
			});
		});
	}

	@OnEvent(BookEvents.CHAPTERS_FIX)
	handleChaptersFix(chapters: Chapter[]) {
		if (!chapters || chapters.length === 0) return;

		const bookId = chapters[0]?.book?.id;
		
		// Apenas admins recebem eventos de correção
		this.broadcast('admin', BookEvents.CHAPTERS_FIX, {
			bookId,
			chapterIds: chapters.map((ch) => ch.id),
		});
	}

	// ==================== EVENTOS DE SCRAPING ====================

	@OnEvent(BookEvents.SCRAPING_STARTED)
	handleChapterScrapingStarted(data: { chapterId: string; bookId: string }) {
		this.broadcast(
			[`book:${data.bookId}`, `chapter:${data.chapterId}`, 'admin'],
			BookEvents.SCRAPING_STARTED,
			data
		);
	}

	@OnEvent(BookEvents.SCRAPING_COMPLETED)
	handleChapterScrapingCompleted(data: {
		chapterId: string;
		bookId: string;
		pagesCount: number;
	}) {
		this.broadcast(
			[`book:${data.bookId}`, `chapter:${data.chapterId}`, 'admin'],
			BookEvents.SCRAPING_COMPLETED,
			data
		);
	}

	@OnEvent(BookEvents.SCRAPING_FAILED)
	handleChapterScrapingFailed(data: {
		chapterId: string;
		bookId: string;
		error: string;
	}) {
		this.broadcast(
			[`book:${data.bookId}`, `chapter:${data.chapterId}`, 'admin'],
			BookEvents.SCRAPING_FAILED,
			data
		);
	}

	// ==================== EVENTOS DE CAPA ====================

	@OnEvent(BookEvents.COVER_PROCESSED)
	handleCoverProcessed(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		this.broadcast('admin', BookEvents.COVER_PROCESSED, data);
	}

	@OnEvent(BookEvents.COVER_SELECTED)
	handleCoverSelected(data: { bookId: string; coverId: string }) {
		this.broadcast([`book:${data.bookId}`, 'admin'], BookEvents.COVER_SELECTED, data);
	}

	@OnEvent(BookEvents.COVER_UPDATED)
	handleCoverUpdated(data: { bookId: string; coverId: string }) {
		this.broadcast([`book:${data.bookId}`, 'admin'], BookEvents.COVER_UPDATED, data);
	}

	@OnEvent(BookEvents.COVER_UPLOADED)
	handleCoverUploaded(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		this.broadcast([`book:${data.bookId}`, 'admin'], BookEvents.COVER_UPLOADED, data);
	}

	@OnEvent(BookEvents.COVERS_UPLOADED)
	handleCoversUploaded(data: {
		bookId: string;
		coverIds: string[];
		count: number;
	}) {
		this.broadcast([`book:${data.bookId}`, 'admin'], BookEvents.COVERS_UPLOADED, data);
	}

	// ==================== EVENTOS DE CAPÍTULOS CRIADOS/UPLOAD ====================

	@OnEvent(BookEvents.CHAPTER_CREATED)
	handleChapterCreated(chapter: Chapter) {
		const bookId = chapter.book?.id;
		
		const chapterData = {
			id: chapter.id,
			title: chapter.title,
			index: chapter.index,
			scrapingStatus: chapter.scrapingStatus,
			bookId,
		};

		this.broadcast([`book:${bookId}`, 'admin'], BookEvents.CHAPTER_CREATED, chapterData);
	}

	@OnEvent(BookEvents.PAGES_UPLOADED)
	handleChapterPagesUploaded(data: {
		bookId: string;
		chapterId: string;
		count: number;
	}) {
		this.broadcast(
			[`book:${data.bookId}`, `chapter:${data.chapterId}`, 'admin'],
			BookEvents.PAGES_UPLOADED,
			data
		);
	}

	// ==================== EVENTOS DE DELEÇÃO ====================

	@OnEvent(BookEvents.DELETED)
	handleBookDeleted(data: {
		bookId: string;
		bookTitle: string;
		covers: string[];
		pages: string[];
	}) {
		const eventData = {
			bookId: data.bookId,
			title: data.bookTitle,
			filesCount: data.covers.length + data.pages.length,
		};
		this.broadcast(['admin', `book:${data.bookId}`], BookEvents.DELETED, eventData);
	}

	@OnEvent(BookEvents.CHAPTER_DELETED)
	handleChapterDeleted(data: {
		chapterId: string;
		bookId?: string;
		pages: string[];
	}) {
		const eventData = {
			chapterId: data.chapterId,
			bookId: data.bookId,
			pagesCount: data.pages.length,
		};
		
		const rooms = ['admin', `chapter:${data.chapterId}`];
		if (data.bookId) {
			rooms.push(`book:${data.bookId}`);
		}

		this.broadcast(rooms, BookEvents.CHAPTER_DELETED, eventData);
	}

	@OnEvent(BookEvents.COVER_DELETED)
	handleCoverDeleted(data: {
		coverId: string;
		url: string;
		bookId?: string;
	}) {
		const eventData = {
			coverId: data.coverId,
			bookId: data.bookId,
		};
		const rooms = ['admin'];
		if (data.bookId) {
			rooms.push(`book:${data.bookId}`);
		}
		this.broadcast(rooms, BookEvents.COVER_DELETED, eventData);
	}

	@OnEvent(BookEvents.PAGE_DELETED)
	handlePageDeleted(data: {
		pageId: string;
		chapterId: string;
		path: string;
	}) {
		const eventData = {
			pageId: data.pageId,
			chapterId: data.chapterId,
		};
		this.broadcast([`chapter:${data.chapterId}`, 'admin'], BookEvents.PAGE_DELETED, eventData);
	}

	@OnEvent(BookEvents.NEW_CHAPTERS)
	handleBookNewChapters(data: {
		bookId: string;
		newChaptersCount: number;
		chapters: Array<{ id: string; title: string; index: number }>;
	}) {
		const eventData = {
			bookId: data.bookId,
			newChaptersCount: data.newChaptersCount,
			chapters: data.chapters,
		};
		this.broadcast([`book:${data.bookId}`, 'admin'], BookEvents.NEW_CHAPTERS, eventData);
	}

	@OnEvent(BookEvents.UPDATE_STARTED)
	handleBookUpdateStarted(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		timestamp: number;
	}) {
		this.broadcast('admin', BookEvents.UPDATE_STARTED, data);
	}

	@OnEvent(BookEvents.UPDATE_COMPLETED)
	handleBookUpdateCompleted(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		newChapters: number;
		newCovers: number;
		timestamp: number;
	}) {
		this.broadcast('admin', BookEvents.UPDATE_COMPLETED, data);
	}

	@OnEvent(BookEvents.UPDATE_FAILED)
	handleBookUpdateFailed(data: {
		bookId: string;
		bookTitle: string;
		jobId: string;
		error: string;
		timestamp: number;
	}) {
		this.broadcast('admin', BookEvents.UPDATE_FAILED, data);
	}
}
