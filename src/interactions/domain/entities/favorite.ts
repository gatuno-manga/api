import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface FavoriteSnapshot {
	userId: string;
	bookId: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}

export class Favorite {
	private constructor(
		private readonly userId: UserId,
		private readonly bookId: BookId,
		private readonly createdAt: Date,
		private readonly updatedAt: Date,
		private readonly deletedAt: Date | null,
	) {}

	public static create(userId: UserId, bookId: BookId): Favorite {
		const now = new Date();
		return new Favorite(userId, bookId, now, now, null);
	}

	public static restore(snapshot: FavoriteSnapshot): Favorite {
		return new Favorite(
			UserId.create(snapshot.userId),
			BookId.create(snapshot.bookId),
			snapshot.createdAt,
			snapshot.updatedAt ?? snapshot.createdAt,
			snapshot.deletedAt ?? null,
		);
	}

	public toSnapshot(): FavoriteSnapshot {
		return {
			userId: this.userId.toString(),
			bookId: this.bookId.toString(),
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
			deletedAt: this.deletedAt,
		};
	}
}
