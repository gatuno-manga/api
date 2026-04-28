import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';

export interface FavoriteSnapshot {
	userId: string;
	bookId: string;
	createdAt: Date;
}

export class Favorite {
	private constructor(
		private readonly userId: UserId,
		private readonly bookId: BookId,
		private readonly createdAt: Date,
	) {}

	public static create(userId: UserId, bookId: BookId): Favorite {
		return new Favorite(userId, bookId, new Date());
	}

	public static restore(snapshot: FavoriteSnapshot): Favorite {
		return new Favorite(
			UserId.create(snapshot.userId),
			BookId.create(snapshot.bookId),
			snapshot.createdAt,
		);
	}

	public toSnapshot(): FavoriteSnapshot {
		return {
			userId: this.userId.toString(),
			bookId: this.bookId.toString(),
			createdAt: this.createdAt,
		};
	}
}
