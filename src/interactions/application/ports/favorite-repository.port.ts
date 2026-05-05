import { Favorite } from '@/interactions/domain/entities/favorite';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';

export interface FavoriteRepository {
	save(favorite: Favorite): Promise<void>;
	delete(userId: UserId, bookId: BookId): Promise<void>;
	isFavorite(userId: UserId, bookId: BookId): Promise<boolean>;
	findByUser(userId: UserId): Promise<Favorite[]>;
}
