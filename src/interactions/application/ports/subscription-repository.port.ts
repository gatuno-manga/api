import { Subscription } from '@/interactions/domain/entities/subscription';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface SubscriptionRepository {
	save(subscription: Subscription): Promise<void>;
	delete(userId: UserId, bookId: BookId): Promise<void>;
	isSubscribed(userId: UserId, bookId: BookId): Promise<boolean>;
	findByBook(bookId: BookId): Promise<Subscription[]>;
}
