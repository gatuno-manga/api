import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { BookEvents } from '@books/domain/constants/events.constant';

@Injectable()
export class NotificationEvents {
	private readonly logger = new Logger(NotificationEvents.name);

	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
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
			// For now, we log the intent as per the current scope
			this.logger.log(
				`[NOTIFICATION] Notifying user ${snapshot.userId} about ${payload.newChaptersCount} new chapters in book ${snapshot.bookId}`,
			);
		}
	}
}
