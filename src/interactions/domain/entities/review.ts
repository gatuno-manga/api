import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';
import { RatingScore } from '../value-objects/rating-score.vo';

export interface ReviewSnapshot {
	userId: string;
	bookId: string;
	rating: number;
	content: string;
	createdAt: Date;
	updatedAt: Date;
}

export class Review {
	private constructor(
		private readonly userId: UserId,
		private readonly bookId: BookId,
		private rating: RatingScore,
		private content: string,
		private readonly createdAt: Date,
		private updatedAt: Date,
	) {}

	public static create(
		userId: UserId,
		bookId: BookId,
		rating: RatingScore,
		content: string,
	): Review {
		const now = new Date();
		return new Review(userId, bookId, rating, content, now, now);
	}

	public static restore(snapshot: ReviewSnapshot): Review {
		return new Review(
			UserId.create(snapshot.userId),
			BookId.create(snapshot.bookId),
			RatingScore.create(snapshot.rating),
			snapshot.content,
			snapshot.createdAt,
			snapshot.updatedAt,
		);
	}

	public update(rating: RatingScore, content: string): void {
		this.rating = rating;
		this.content = content;
		this.updatedAt = new Date();
	}

	public toSnapshot(): ReviewSnapshot {
		return {
			userId: this.userId.toString(),
			bookId: this.bookId.toString(),
			rating: this.rating.toNumber(),
			content: this.content,
			createdAt: this.createdAt,
			updatedAt: this.updatedAt,
		};
	}
}
