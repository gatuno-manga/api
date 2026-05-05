import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ReviewRepository } from '@/interactions/application/ports/review-repository.port';
import { Review } from '@/interactions/domain/entities/review';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { RatingScore } from '@/interactions/domain/value-objects/rating-score.vo';
import { InteractionEvents } from '@/interactions/domain/constants/events.constant';

@Injectable()
export class ReviewBookUseCase {
	constructor(
		@Inject('ReviewRepository')
		private readonly reviewRepository: ReviewRepository,
		private readonly eventEmitter: EventEmitter2,
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
		let isNew = false;

		if (review) {
			review.update(score, content);
		} else {
			review = Review.create(user, book, score, content);
			isNew = true;
		}

		await this.reviewRepository.save(review);
		this.eventEmitter.emit(
			isNew
				? InteractionEvents.REVIEW_CREATED
				: InteractionEvents.REVIEW_UPDATED,
			review,
		);
	}
}
