import { Favorite } from '@/interactions/domain/entities/favorite';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface FavoriteRepository {
	save(favorite: Favorite): Promise<void>;
	delete(userId: UserId, bookId: BookId): Promise<void>;
	isFavorite(userId: UserId, bookId: BookId): Promise<boolean>;
	findByUser(userId: UserId): Promise<Favorite[]>;
	findPaginatedByUser(
		userId: UserId,
		limit: number,
		cursorCreatedAt?: Date,
		cursorBookId?: string,
	): Promise<Favorite[]>;
	findByUserWithOffset(
		userId: UserId,
		skip: number,
		take: number,
	): Promise<[Favorite[], number]>;
}
