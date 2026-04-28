import { Review } from './review';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';
import { RatingScore } from '../value-objects/rating-score.vo';

describe('Review Domain Entity', () => {
	it('should create a review with valid rating', () => {
		const userId = UserId.generate();
		const bookId = BookId.generate();
		const rating = RatingScore.create(5);
		const review = Review.create(userId, bookId, rating, 'Great book!');

		const snapshot = review.toSnapshot();
		expect(snapshot.rating).toBe(5);
		expect(snapshot.content).toBe('Great book!');
	});

	it('should throw error for invalid rating', () => {
		expect(() => RatingScore.create(6)).toThrow();
		expect(() => RatingScore.create(0)).toThrow();
	});
});
