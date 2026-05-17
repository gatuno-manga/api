import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { Subscription } from '@/interactions/domain/entities/subscription';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SubscribeToBookUseCase {
	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
	) {}

	async execute(userId: string, bookId: string): Promise<void> {
		const user = UserId.create(userId);
		const book = BookId.create(bookId);
		const subscription = Subscription.create(user, book);
		await this.subscriptionRepository.save(subscription);
	}
}
