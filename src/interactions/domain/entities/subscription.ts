import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';

export interface SubscriptionSnapshot {
	userId: string;
	bookId: string;
	createdAt: Date;
}

export class Subscription {
	private constructor(
		private readonly userId: UserId,
		private readonly bookId: BookId,
		private readonly createdAt: Date,
	) {}

	public static create(userId: UserId, bookId: BookId): Subscription {
		return new Subscription(userId, bookId, new Date());
	}

	public static restore(snapshot: SubscriptionSnapshot): Subscription {
		return new Subscription(
			UserId.create(snapshot.userId),
			BookId.create(snapshot.bookId),
			snapshot.createdAt,
		);
	}

	public toSnapshot(): SubscriptionSnapshot {
		return {
			userId: this.userId.toString(),
			bookId: this.bookId.toString(),
			createdAt: this.createdAt,
		};
	}
}
