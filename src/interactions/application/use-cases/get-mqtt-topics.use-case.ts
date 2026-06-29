import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { MqttTopics } from '@common/domain/constants/mqtt-topics.constant';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class GetMqttTopicsUseCase {
	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
	) {}

	async execute(userId: string): Promise<string[]> {
		const user = UserId.create(userId);
		const subscriptions =
			await this.subscriptionRepository.findByUser(user);

		// Tópicos base do usuário
		const topics = [
			`users/${userId}/notifications`,
			MqttTopics.USERS.READING_PROGRESS(userId),
		];

		// Tópicos dos livros inscritos
		for (const sub of subscriptions) {
			const bookId = sub.toSnapshot().bookId;
			topics.push(MqttTopics.BOOKS.BOOK(bookId));
		}

		return topics;
	}
}
