import { Inject, Injectable } from '@nestjs/common';
import { SubscriptionRepository } from '../ports/subscription-repository.port';
import { Subscription } from '../../domain/entities/subscription';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';

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
