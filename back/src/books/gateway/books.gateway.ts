import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayInit,
	OnGatewayConnection,
	OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Book } from '../entitys/book.entity';
import { Chapter } from '../entitys/chapter.entity';
import { WsJwtGuard } from '../../auth/guard/ws-jwt.guard';
import { RolesEnum } from '../../users/enum/roles.enum';

/**
 * Gateway WebSocket para comunicação em tempo real de eventos de livros
 * Implementa o padrão Observer para notificar clientes sobre mudanças
 *
 * Segurança:
 * - Autenticação via JWT
 * - Eventos gerais (broadcast) apenas para ADMIN
 * - Usuários comuns recebem apenas eventos de livros/capítulos inscritos
 *
 * Rooms disponíveis:
 * - book:{bookId} - Eventos de um livro específico
 * - chapter:{chapterId} - Eventos de um capítulo específico
 * - admin - Eventos globais (apenas admins)
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
	transports: ['websocket', 'polling'], // Adiciona polling como fallback
})
export class BooksGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
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

			// ==================== EVENTOS DE INSCRIÇÃO ====================

			/**
			 * Cliente se inscreve em um livro específico
			 */
			client.on('subscribe:book', (bookId: string) => {
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
			});

			/**
			 * Cliente se inscreve em um capítulo específico
			 */
			client.on('subscribe:chapter', (chapterId: string) => {
				try {
					if (!chapterId || typeof chapterId !== 'string') {
						client.emit('error', { message: 'Invalid chapterId' });
						return;
					}

					client.join(`chapter:${chapterId}`);
					this.connectedClients
						.get(client.id)
						?.chapterIds.add(chapterId);

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
			});

			/**
			 * Cliente cancela inscrição em um livro
			 */
			client.on('unsubscribe:book', (bookId: string) => {
				try {
					client.leave(`book:${bookId}`);
					this.connectedClients
						.get(client.id)
						?.bookIds.delete(bookId);

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
			});

			/**
			 * Cliente cancela inscrição em um capítulo
			 */
			client.on('unsubscribe:chapter', (chapterId: string) => {
				try {
					client.leave(`chapter:${chapterId}`);
					this.connectedClients
						.get(client.id)
						?.chapterIds.delete(chapterId);

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
			});

			/**
			 * Cliente solicita suas inscrições atuais
			 */
			client.on('list:subscriptions', () => {
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
			});
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

	// ==================== EVENTOS DE LIVROS ====================

	/**
	 * Notifica quando um livro é criado
	 * Apenas admins recebem broadcast global
	 */
	@OnEvent('book.created')
	handleBookCreated(book: Book) {
		try {
			this.logger.debug(
				`Broadcasting book.created event for book ${book.id}`,
			);
			// Apenas admins recebem eventos de criação
			this.server.to('admin').emit('book.created', {
				id: book.id,
				title: book.title,
				type: book.type,
				createdAt: book.createdAt,
			});
		} catch (error) {
			this.logger.error(
				`Failed to broadcast book.created for book ${book.id}: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando um livro é atualizado
	 * Envia apenas para clientes inscritos no livro
	 */
	@OnEvent('book.updated')
	handleBookUpdated(book: Book) {
		try {
			this.logger.debug(
				`Broadcasting book.updated event for book ${book.id}`,
			);
			// Envia para room específica do livro
			this.server.to(`book:${book.id}`).emit('book.updated', {
				id: book.id,
				title: book.title,
				updatedAt: book.updatedAt,
			});
		} catch (error) {
			this.logger.error(
				`Failed to broadcast book.updated for book ${book.id}: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE CAPÍTULOS ====================

	/**
	 * Notifica quando capítulos são atualizados
	 * Envia para room do livro e rooms específicas de cada capítulo
	 */
	@OnEvent('chapters.updated')
	handleChaptersUpdated(payload: Chapter | Chapter[]) {
		try {
			// Normaliza para sempre trabalhar com array
			const chapters = Array.isArray(payload) ? payload : [payload];

			if (!chapters || chapters.length === 0) return;

			const bookId = chapters[0]?.book?.id;
			this.logger.debug(
				`Broadcasting chapters.updated event for ${chapters.length} chapters`,
			);

			const chapterData = chapters.map((ch) => ({
				id: ch.id,
				title: ch.title,
				index: ch.index,
				scrapingStatus: ch.scrapingStatus,
			}));

			// Envia para room do livro
			this.server.to(`book:${bookId}`).emit('chapters.updated', {
				bookId,
				chapters: chapterData,
			});

			// Também envia para admins
			this.server.to('admin').emit('chapters.updated', {
				bookId,
				chapters: chapterData,
			});

			// Envia para rooms específicas de cada capítulo
			chapters.forEach((chapter) => {
				this.server
					.to(`chapter:${chapter.id}`)
					.emit('chapter.updated', {
						bookId,
						chapter: {
							id: chapter.id,
							title: chapter.title,
							index: chapter.index,
							scrapingStatus: chapter.scrapingStatus,
						},
					});
			});
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapters.updated: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando capítulos precisam ser corrigidos
	 * Apenas admins recebem este evento
	 */
	@OnEvent('chapters.fix')
	handleChaptersFix(chapters: Chapter[]) {
		try {
			if (!chapters || chapters.length === 0) return;

			const bookId = chapters[0]?.book?.id;
			this.logger.debug(
				`Broadcasting chapters.fix event for ${chapters.length} chapters`,
			);

			// Apenas admins recebem eventos de correção
			this.server.to('admin').emit('chapters.fix', {
				bookId,
				chapterIds: chapters.map((ch) => ch.id),
			});
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapters.fix: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE SCRAPING ====================

	/**
	 * Notifica quando um capítulo inicia scraping
	 */
	@OnEvent('chapter.scraping.started')
	handleChapterScrapingStarted(data: { chapterId: string; bookId: string }) {
		try {
			this.logger.debug(
				`Broadcasting chapter.scraping.started for chapter ${data.chapterId}`,
			);
			// Envia para room do livro e do capítulo
			this.server
				.to(`book:${data.bookId}`)
				.emit('chapter.scraping.started', data);
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('chapter.scraping.started', data);
			// Também envia para admins
			this.server.to('admin').emit('chapter.scraping.started', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.scraping.started: ${error.message}`,
			);
		}
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
		try {
			this.logger.debug(
				`Broadcasting chapter.scraping.completed for chapter ${data.chapterId}`,
			);
			// Envia para room do livro e do capítulo
			this.server
				.to(`book:${data.bookId}`)
				.emit('chapter.scraping.completed', data);
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('chapter.scraping.completed', data);
			// Também envia para admins
			this.server.to('admin').emit('chapter.scraping.completed', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.scraping.completed: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando um capítulo falha no scraping
	 */
	@OnEvent('chapter.scraping.failed')
	handleChapterScrapingFailed(data: {
		chapterId: string;
		bookId: string;
		error: string;
	}) {
		try {
			this.logger.debug(
				`Broadcasting chapter.scraping.failed for chapter ${data.chapterId}`,
			);
			// Envia para room do livro e do capítulo
			this.server
				.to(`book:${data.bookId}`)
				.emit('chapter.scraping.failed', data);
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('chapter.scraping.failed', data);
			// Também envia para admins
			this.server.to('admin').emit('chapter.scraping.failed', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.scraping.failed: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE CAPA ====================

	/**
	 * Notifica quando uma capa é processada
	 * Apenas admins recebem broadcast global
	 */
	@OnEvent('cover.processed')
	handleCoverProcessed(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		try {
			this.logger.debug(
				`Broadcasting cover.processed for book ${data.bookId}`,
			);
			// Envia para admins
			this.server.to('admin').emit('cover.processed', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast cover.processed: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando uma capa é selecionada
	 * Envia para room do livro e admins
	 */
	@OnEvent('cover.selected')
	handleCoverSelected(data: { bookId: string; coverId: string }) {
		try {
			this.logger.debug(
				`Broadcasting cover.selected for book ${data.bookId}`,
			);
			// Envia para room do livro e admins
			this.server.to(`book:${data.bookId}`).emit('cover.selected', data);
			this.server.to('admin').emit('cover.selected', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast cover.selected: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando uma capa é atualizada
	 * Envia para room do livro e admins
	 */
	@OnEvent('cover.updated')
	handleCoverUpdated(data: { bookId: string; coverId: string }) {
		try {
			this.logger.debug(
				`Broadcasting cover.updated for book ${data.bookId}`,
			);
			this.server.to(`book:${data.bookId}`).emit('cover.updated', data);
			this.server.to('admin').emit('cover.updated', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast cover.updated: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando uma capa é uploadada manualmente
	 * Envia para room do livro e admins
	 */
	@OnEvent('cover.uploaded')
	handleCoverUploaded(data: {
		bookId: string;
		coverId: string;
		url: string;
	}) {
		try {
			this.logger.debug(
				`Broadcasting cover.uploaded for book ${data.bookId}`,
			);
			this.server.to(`book:${data.bookId}`).emit('cover.uploaded', data);
			this.server.to('admin').emit('cover.uploaded', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast cover.uploaded: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando múltiplas capas são uploadadas
	 * Apenas admins recebem
	 */
	@OnEvent('covers.uploaded')
	handleCoversUploaded(data: {
		bookId: string;
		coverIds: string[];
		count: number;
	}) {
		try {
			this.logger.debug(
				`Broadcasting covers.uploaded for book ${data.bookId} (${data.count} covers)`,
			);
			this.server.to(`book:${data.bookId}`).emit('covers.uploaded', data);
			this.server.to('admin').emit('covers.uploaded', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast covers.uploaded: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE CAPÍTULOS CRIADOS/UPLOAD ====================

	/**
	 * Notifica quando um capítulo é criado
	 * Envia para room do livro e admins
	 */
	@OnEvent('chapter.created')
	handleChapterCreated(chapter: Chapter) {
		try {
			const bookId = chapter.book?.id;
			this.logger.debug(
				`Broadcasting chapter.created for chapter ${chapter.id}`,
			);

			const chapterData = {
				id: chapter.id,
				title: chapter.title,
				index: chapter.index,
				scrapingStatus: chapter.scrapingStatus,
				bookId,
			};

			this.server
				.to(`book:${bookId}`)
				.emit('chapter.created', chapterData);
			this.server.to('admin').emit('chapter.created', chapterData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.created: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando páginas de um capítulo são uploadadas
	 * Envia para room do livro e do capítulo
	 */
	@OnEvent('chapter.pages.uploaded')
	handleChapterPagesUploaded(data: {
		bookId: string;
		chapterId: string;
		count: number;
	}) {
		try {
			this.logger.debug(
				`Broadcasting chapter.pages.uploaded for chapter ${data.chapterId}`,
			);
			this.server
				.to(`book:${data.bookId}`)
				.emit('chapter.pages.uploaded', data);
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('chapter.pages.uploaded', data);
			this.server.to('admin').emit('chapter.pages.uploaded', data);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.pages.uploaded: ${error.message}`,
			);
		}
	}

	// ==================== EVENTOS DE DELEÇÃO ====================

	/**
	 * Notifica quando um livro é deletado
	 * Apenas admins recebem
	 */
	@OnEvent('book.deleted')
	handleBookDeleted(data: {
		bookId: string;
		bookTitle: string;
		covers: string[];
		pages: string[];
	}) {
		try {
			this.logger.debug(
				`Broadcasting book.deleted for book ${data.bookId}`,
			);
			const eventData = {
				bookId: data.bookId,
				title: data.bookTitle,
				filesCount: data.covers.length + data.pages.length,
			};
			this.server.to('admin').emit('book.deleted', eventData);
			// Também notifica quem estava inscrito no livro
			this.server
				.to(`book:${data.bookId}`)
				.emit('book.deleted', eventData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast book.deleted: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando um capítulo é deletado
	 * Envia para room do livro e admins
	 */
	@OnEvent('chapter.deleted')
	handleChapterDeleted(data: {
		chapterId: string;
		bookId?: string;
		pages: string[];
	}) {
		try {
			this.logger.debug(
				`Broadcasting chapter.deleted for chapter ${data.chapterId}`,
			);
			const eventData = {
				chapterId: data.chapterId,
				bookId: data.bookId,
				pagesCount: data.pages.length,
			};
			if (data.bookId) {
				this.server
					.to(`book:${data.bookId}`)
					.emit('chapter.deleted', eventData);
			}
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('chapter.deleted', eventData);
			this.server.to('admin').emit('chapter.deleted', eventData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast chapter.deleted: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando uma capa é deletada
	 * Envia para room do livro e admins
	 */
	@OnEvent('cover.deleted')
	handleCoverDeleted(data: {
		coverId: string;
		url: string;
		bookId?: string;
	}) {
		try {
			this.logger.debug(
				`Broadcasting cover.deleted for cover ${data.coverId}`,
			);
			const eventData = {
				coverId: data.coverId,
				bookId: data.bookId,
			};
			if (data.bookId) {
				this.server
					.to(`book:${data.bookId}`)
					.emit('cover.deleted', eventData);
			}
			this.server.to('admin').emit('cover.deleted', eventData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast cover.deleted: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando uma página é deletada
	 * Envia para room do capítulo e admins
	 */
	@OnEvent('page.deleted')
	handlePageDeleted(data: {
		pageId: string;
		chapterId: string;
		path: string;
	}) {
		try {
			this.logger.debug(
				`Broadcasting page.deleted for page ${data.pageId}`,
			);
			const eventData = {
				pageId: data.pageId,
				chapterId: data.chapterId,
			};
			this.server
				.to(`chapter:${data.chapterId}`)
				.emit('page.deleted', eventData);
			this.server.to('admin').emit('page.deleted', eventData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast page.deleted: ${error.message}`,
			);
		}
	}

	/**
	 * Notifica quando novos capítulos são encontrados durante atualização automática
	 * Envia para room do livro e admins
	 */
	@OnEvent('book.new-chapters')
	handleBookNewChapters(data: {
		bookId: string;
		newChaptersCount: number;
		chapters: Array<{ id: string; title: string; index: number }>;
	}) {
		try {
			this.logger.debug(
				`Broadcasting book.new-chapters for book ${data.bookId} with ${data.newChaptersCount} new chapters`,
			);
			const eventData = {
				bookId: data.bookId,
				newChaptersCount: data.newChaptersCount,
				chapters: data.chapters,
			};
			this.server
				.to(`book:${data.bookId}`)
				.emit('book.new-chapters', eventData);
			this.server.to('admin').emit('book.new-chapters', eventData);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast book.new-chapters: ${error.message}`,
			);
		}
	}
}
