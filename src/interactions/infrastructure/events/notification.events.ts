import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import { BookEvents } from '@books/domain/constants/events.constant';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { MediaUrlService } from '@common/services/media-url.service';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientProxy } from '@nestjs/microservices';
import { WebPushService } from '@users/infrastructure/web-push/web-push.service';

@Injectable()
export class NotificationEvents {
	private readonly logger = new Logger(NotificationEvents.name);

	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		@Inject('MQTT_CLIENT') private readonly mqttClient: ClientProxy,
		private readonly webPushService: WebPushService,
		private readonly mediaUrlService: MediaUrlService,
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

		const book = await this.bookRepository.findById(payload.bookId);
		let bookTitle = 'Gatuno: Capítulos Novos!';
		let imageUrl: string | undefined;

		if (book) {
			bookTitle = `Gatuno: ${book.title}`;
			const primaryCover =
				book.covers?.find((c) => c.selected) || book.covers?.[0];
			if (primaryCover) {
				imageUrl = this.mediaUrlService.resolveUrl(
					primaryCover.url,
					StorageBucket.BOOKS,
				);
			}
		}

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

			this.webPushService.notifyUser(snapshot.userId, {
				title: bookTitle,
				body: `${payload.newChaptersCount} novo(s) capítulo(s) foram adicionados ao livro que você acompanha.`,
				url: `/book/${payload.bookId}`,
				image: imageUrl,
			});
		}
	}
}
