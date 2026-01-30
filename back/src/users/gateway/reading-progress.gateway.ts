import {
	WebSocketGateway,
	WebSocketServer,
	SubscribeMessage,
	MessageBody,
	ConnectedSocket,
	OnGatewayInit,
	OnGatewayConnection,
	OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WsJwtGuard } from '../../auth/guard/ws-jwt.guard';
import { ReadingProgressService } from '../reading-progress.service';
import {
	SaveReadingProgressDto,
	ReadingProgressResponseDto,
} from '../dto/reading-progress.dto';
import { ReadingEvents } from '../constants/events.constant';

interface ProgressUpdatePayload {
	userId: string;
	progress: ReadingProgressResponseDto;
}

interface ProgressDeletePayload {
	userId: string;
	chapterId: string;
}

interface BookProgressDeletePayload {
	userId: string;
	bookId: string;
}

/**
 * Gateway WebSocket para sincronização em tempo real do progresso de leitura
 *
 * Features:
 * - Sincronização bidirecional em tempo real
 * - Suporte a múltiplos dispositivos do mesmo usuário
 * - Reconexão automática com restauração de estado
 *
 * Rooms:
 * - user:{userId} - Eventos do usuário (sincronização entre dispositivos)
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
	namespace: '/reading-progress',
	transports: ['websocket', 'polling'],
})
export class ReadingProgressGateway
	implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer()
	server: Server;

	private readonly logger = new Logger(ReadingProgressGateway.name);
	private connectedClients = new Map<
		string,
		{ userId: string; socketIds: Set<string> }
	>();

	constructor(private readonly progressService: ReadingProgressService) {}

	afterInit(server: Server) {
		this.logger.log(
			'WebSocket Gateway initialized on namespace /reading-progress',
		);
	}

	handleConnection(client: Socket) {
		try {
			const user = client.data.user;
			if (!user?.id) {
				this.logger.warn(
					`Client ${client.id} connected without valid user`,
				);
				client.disconnect();
				return;
			}

			const userId = user.id;

			// Adiciona cliente à room do usuário
			client.join(`user:${userId}`);

			// Rastreia conexão
			if (!this.connectedClients.has(userId)) {
				this.connectedClients.set(userId, {
					userId,
					socketIds: new Set(),
				});
			}
			this.connectedClients.get(userId)?.socketIds.add(client.id);

			this.logger.log(
				`Client connected: ${client.id} for user ${userId} (Total: ${this.connectedClients.get(userId)?.socketIds.size})`,
			);

			// Envia confirmação de conexão
			client.emit('connected', {
				message: 'Connected to reading progress sync',
				userId,
			});
		} catch (error) {
			this.logger.error(`Error in handleConnection: ${error.message}`);
			client.disconnect();
		}
	}

	handleDisconnect(client: Socket) {
		try {
			const user = client.data.user;
			if (user?.id) {
				const clientData = this.connectedClients.get(user.id);
				if (clientData) {
					clientData.socketIds.delete(client.id);
					if (clientData.socketIds.size === 0) {
						this.connectedClients.delete(user.id);
					}
				}
				this.logger.log(
					`Client disconnected: ${client.id} for user ${user.id}`,
				);
			}
		} catch (error) {
			this.logger.error(`Error in handleDisconnect: ${error.message}`);
		}
	}

	/**
	 * Cliente envia atualização de progresso
	 */
	@SubscribeMessage('progress:update')
	async handleProgressUpdate(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: SaveReadingProgressDto,
	) {
		try {
			const userId = client.data.user?.id;
			if (!userId) {
				client.emit('error', { message: 'User not authenticated' });
				return;
			}

			const saved = await this.progressService.saveProgress(userId, data);

			// Confirma para o cliente que enviou
			client.emit('progress:saved', saved);

			// Propaga para outros dispositivos do mesmo usuário
			client.to(`user:${userId}`).emit('progress:synced', saved);

			this.logger.debug(
				`Progress updated via WS: user=${userId}, chapter=${data.chapterId}, page=${data.pageIndex}`,
			);
		} catch (error) {
			this.logger.error(
				`Error handling progress update: ${error.message}`,
			);
			client.emit('error', { message: 'Failed to save progress' });
		}
	}

	/**
	 * Cliente solicita sincronização completa
	 */
	@SubscribeMessage('progress:sync')
	async handleSyncRequest(@ConnectedSocket() client: Socket) {
		try {
			const userId = client.data.user?.id;
			if (!userId) {
				client.emit('error', { message: 'User not authenticated' });
				return;
			}

			const allProgress =
				await this.progressService.getAllProgress(userId);
			client.emit('progress:sync:complete', {
				progress: allProgress,
				syncedAt: new Date(),
			});

			this.logger.debug(
				`Full sync sent to user ${userId}: ${allProgress.length} items`,
			);
		} catch (error) {
			this.logger.error(`Error handling sync request: ${error.message}`);
			client.emit('error', { message: 'Failed to sync progress' });
		}
	}

	/**
	 * Cliente solicita progresso de um livro específico
	 */
	@SubscribeMessage('progress:book')
	async handleBookProgressRequest(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { bookId: string },
	) {
		try {
			const userId = client.data.user?.id;
			if (!userId) {
				client.emit('error', { message: 'User not authenticated' });
				return;
			}

			const bookProgress = await this.progressService.getBookProgress(
				userId,
				data.bookId,
			);
			client.emit('progress:book:response', bookProgress);
		} catch (error) {
			this.logger.error(
				`Error handling book progress request: ${error.message}`,
			);
			client.emit('error', { message: 'Failed to get book progress' });
		}
	}

	/**
	 * Cliente solicita progresso de um capítulo específico
	 */
	@SubscribeMessage('progress:chapter')
	async handleChapterProgressRequest(
		@ConnectedSocket() client: Socket,
		@MessageBody() data: { chapterId: string },
	) {
		try {
			const userId = client.data.user?.id;
			if (!userId) {
				client.emit('error', { message: 'User not authenticated' });
				return;
			}

			const progress = await this.progressService.getProgress(
				userId,
				data.chapterId,
			);
			client.emit('progress:chapter:response', {
				chapterId: data.chapterId,
				progress,
			});
		} catch (error) {
			this.logger.error(
				`Error handling chapter progress request: ${error.message}`,
			);
			client.emit('error', { message: 'Failed to get chapter progress' });
		}
	}

	// ==================== EVENT HANDLERS ====================

	/**
	 * Propaga atualização de progresso para todos os dispositivos do usuário
	 */
	@OnEvent(ReadingEvents.UPDATED)
	handleProgressUpdatedEvent(payload: ProgressUpdatePayload) {
		try {
			this.server
				.to(`user:${payload.userId}`)
				.emit('progress:synced', payload.progress);
		} catch (error) {
			this.logger.error(
				`Failed to broadcast progress update: ${error.message}`,
			);
		}
	}

	/**
	 * Propaga deleção de progresso para todos os dispositivos do usuário
	 */
	@OnEvent(ReadingEvents.DELETED)
	handleProgressDeletedEvent(payload: ProgressDeletePayload) {
		try {
			this.server
				.to(`user:${payload.userId}`)
				.emit('progress:deleted', { chapterId: payload.chapterId });
		} catch (error) {
			this.logger.error(
				`Failed to broadcast progress deletion: ${error.message}`,
			);
		}
	}

	/**
	 * Propaga deleção de progresso de um livro para todos os dispositivos
	 */
	@OnEvent(ReadingEvents.BOOK_DELETED)
	handleBookProgressDeletedEvent(payload: BookProgressDeletePayload) {
		try {
			this.server
				.to(`user:${payload.userId}`)
				.emit('progress:book:deleted', { bookId: payload.bookId });
		} catch (error) {
			this.logger.error(
				`Failed to broadcast book progress deletion: ${error.message}`,
			);
		}
	}
}
