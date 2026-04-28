import { Inject, Injectable } from '@nestjs/common';
import { ReviewRepository } from '../ports/review-repository.port';
import { Review } from '../../domain/entities/review';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { BookId } from '../../../common/domain/value-objects/book-id.vo';
import { RatingScore } from '../../domain/value-objects/rating-score.vo';

@Injectable()
export class ReviewBookUseCase {
	constructor(
		@Inject('ReviewRepository')
		private readonly reviewRepository: ReviewRepository,
	) {}

	async execute(
		userId: string,
		bookId: string,
		rating: number,
		content: string,
	): Promise<void> {
		const user = UserId.create(userId);
		const book = BookId.create(bookId);
		const score = RatingScore.create(rating);

		let review = await this.reviewRepository.findById(user, book);
		if (review) {
			review.update(score, content);
		} else {
			review = Review.create(user, book, score, content);
		}

		await this.reviewRepository.save(review);
	}
}
