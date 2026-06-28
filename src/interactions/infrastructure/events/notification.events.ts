import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { BookEvents } from '@books/domain/constants/events.constant';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class NotificationEvents {
	private readonly logger = new Logger(NotificationEvents.name);

	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject('MQTT_CLIENT') private readonly mqttClient: ClientProxy,
	) {}

	@OnEvent(BookEvents.NEW_CHAPTERS)
	async handleNewChapters(payload: {
		bookId: string;
		newChaptersCount: number;
		chapters: Array<{ id: string; title: string; index: number }>;
	}) {
		this.logger.log(
			`New chapters added to book ${payload.bookId}. Notifying subscribers...`,
		);

		const subscriptions = await this.subscriptionRepository.findByBook(
			BookId.create(payload.bookId),
		);

		for (const sub of subscriptions) {
			const snapshot = sub.toSnapshot();
			// Here we would call a Notification Service (Push, Email, etc.)
			// We are also emitting real-time MQTT events to connected clients
			this.logger.log(
				`[NOTIFICATION] Notifying user ${snapshot.userId} about ${payload.newChaptersCount} new chapters in book ${snapshot.bookId}`,
			);

			this.mqttClient.emit(`users/${snapshot.userId}/notifications`, {
				event: 'book.new_chapters',
				payload: {
					bookId: payload.bookId,
					newChaptersCount: payload.newChaptersCount,
					chapters: payload.chapters,
					timestamp: new Date().toISOString(),
				},
			});
		}
	}
}
