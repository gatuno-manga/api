import { BookRequestEvents } from '@/book-requests/domain/constants/events.constant';
import { BookRequest } from '@/book-requests/domain/entities/book-request';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { WebPushService } from '@users/infrastructure/web-push/web-push.service';
import { DataSource } from 'typeorm';

@Injectable()
export class BookRequestsNotifier {
	private readonly logger = new Logger(BookRequestsNotifier.name);

	constructor(
		@Inject('MQTT_CLIENT')
		private readonly mqttClient: ClientProxy,
		private readonly webPushService: WebPushService,
		private readonly dataSource: DataSource,
	) {}

	private publish(topic: string, event: string, payload: unknown) {
		try {
			this.mqttClient.emit(topic, { event, payload });
		} catch (error: unknown) {
			this.logger.error(
				`Exception when publishing to ${topic}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	@OnEvent(BookRequestEvents.CREATED)
	async handleRequestCreated(request: BookRequest) {
		// Notifica o Admin Panel em tempo real via MQTT
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.CREATED, {
			id: request.header.identity.id.toString(),
			userId: request.header.identity.userId.toString(),
			title: request.body.proposition.info.title.toString(),
			url: request.body.proposition.info.url.toString(),
			createdAt: request.header.timing.createdAt,
		});

		try {
			// Busca todos os administradores para notificar via Web Push
			const admins = await this.dataSource.manager
				.createQueryBuilder(User, 'user')
				.innerJoin('user.roles', 'role', 'role.name = :roleName', {
					roleName: 'ADMIN',
				})
				.select(['user.id'])
				.getMany();

			const sendPromises = admins.map((admin) =>
				this.webPushService.notifyUser(admin.id, {
					title: 'Novo Pedido de Livro!',
					body: `Um novo pedido foi sugerido para o livro "${request.body.proposition.info.title.toString()}".`,
					url: '/admin/requests',
				}),
			);

			await Promise.allSettled(sendPromises);
		} catch (error: unknown) {
			this.logger.error(
				`Failed to notify admins via web push: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	@OnEvent(BookRequestEvents.APPROVED)
	handleRequestApproved(request: BookRequest) {
		const userId = request.header.identity.userId.toString();
		const title = request.body.proposition.info.title.toString();
		const requestId = request.header.identity.id.toString();

		// Notifica o usuário em tempo real via MQTT
		this.publish(
			`users/${userId}/notifications`,
			BookRequestEvents.APPROVED,
			{
				isTranslatable: true,
				titleKey: 'NOTIFICATIONS.BOOK_REQUEST_APPROVED_TITLE',
				messageKey: 'NOTIFICATIONS.BOOK_REQUEST_APPROVED_BODY',
				args: { title },
				data: { requestId },
			},
		);

		// Notifica o usuário via Web Push
		this.webPushService.notifyUser(userId, {
			title: 'Pedido de Livro Aprovado!',
			body: `Seu pedido para adicionar o livro "${title}" foi aprovado!`,
			url: '/requests',
		});

		// Atualiza o painel Admin
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.APPROVED, {
			id: requestId,
		});
	}

	@OnEvent(BookRequestEvents.REJECTED)
	handleRequestRejected(request: BookRequest) {
		const userId = request.header.identity.userId.toString();
		const title = request.body.proposition.info.title.toString();
		const reason =
			request.body.outcome.resolution.rejectionMessage?.toString();
		const requestId = request.header.identity.id.toString();

		// Notifica o usuário em tempo real via MQTT
		this.publish(
			`users/${userId}/notifications`,
			BookRequestEvents.REJECTED,
			{
				isTranslatable: true,
				titleKey: 'NOTIFICATIONS.BOOK_REQUEST_REJECTED_TITLE',
				messageKey: 'NOTIFICATIONS.BOOK_REQUEST_REJECTED_BODY',
				args: { title, reason },
				data: { requestId },
			},
		);

		// Notifica o usuário via Web Push
		this.webPushService.notifyUser(userId, {
			title: 'Pedido de Livro Rejeitado',
			body: `Seu pedido para o livro "${title}" não pôde ser aprovado. Motivo: ${reason || 'Não informado'}`,
			url: '/requests',
		});

		// Atualiza o painel Admin
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.REJECTED, {
			id: requestId,
			reason,
		});
	}
}
