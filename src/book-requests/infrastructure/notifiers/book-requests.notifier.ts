import { BookRequestEvents } from '@/book-requests/domain/constants/events.constant';
import { BookRequest } from '@/book-requests/domain/entities/book-request';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class BookRequestsNotifier {
	private readonly logger = new Logger(BookRequestsNotifier.name);

	constructor(
		@Inject('MQTT_CLIENT')
		private readonly mqttClient: ClientProxy,
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
	handleRequestCreated(request: BookRequest) {
		// Notifica o Admin Panel em tempo real
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.CREATED, {
			id: request.header.identity.id.toString(),
			userId: request.header.identity.userId.toString(),
			title: request.body.proposition.info.title.toString(),
			url: request.body.proposition.info.url.toString(),
			createdAt: request.header.timing.createdAt,
		});
	}

	@OnEvent(BookRequestEvents.APPROVED)
	handleRequestApproved(request: BookRequest) {
		const userId = request.header.identity.userId.toString();
		const title = request.body.proposition.info.title.toString();

		// Notifica o usuário que o pedido dele foi aprovado
		this.publish(
			`users/${userId}/notifications`,
			BookRequestEvents.APPROVED,
			{
				isTranslatable: true,
				titleKey: 'NOTIFICATIONS.BOOK_REQUEST_APPROVED_TITLE',
				messageKey: 'NOTIFICATIONS.BOOK_REQUEST_APPROVED_BODY',
				args: { title },
				data: { requestId: request.header.identity.id.toString() },
			},
		);

		// Atualiza o painel Admin
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.APPROVED, {
			id: request.header.identity.id.toString(),
		});
	}

	@OnEvent(BookRequestEvents.REJECTED)
	handleRequestRejected(request: BookRequest) {
		const userId = request.header.identity.userId.toString();
		const title = request.body.proposition.info.title.toString();
		const reason =
			request.body.outcome.resolution.rejectionMessage?.toString();

		// Notifica o usuário que o pedido dele foi rejeitado
		this.publish(
			`users/${userId}/notifications`,
			BookRequestEvents.REJECTED,
			{
				isTranslatable: true,
				titleKey: 'NOTIFICATIONS.BOOK_REQUEST_REJECTED_TITLE',
				messageKey: 'NOTIFICATIONS.BOOK_REQUEST_REJECTED_BODY',
				args: { title, reason },
				data: { requestId: request.header.identity.id.toString() },
			},
		);

		// Atualiza o painel Admin
		this.publish(MqttTopics.BOOKS.ADMIN, BookRequestEvents.REJECTED, {
			id: request.header.identity.id.toString(),
			reason,
		});
	}
}
