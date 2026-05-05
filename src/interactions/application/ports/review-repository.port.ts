import { Review } from '@/interactions/domain/entities/review';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';

export interface ReviewRepository {
	save(review: Review): Promise<void>;
	findById(userId: UserId, bookId: BookId): Promise<Review | null>;
	findByBook(bookId: BookId): Promise<Review[]>;
	delete(userId: UserId, bookId: BookId): Promise<void>;
}
