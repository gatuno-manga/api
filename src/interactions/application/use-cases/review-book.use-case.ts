import { ReviewRepository } from '@/interactions/application/ports/review-repository.port';
import { InteractionEvents } from '@/interactions/domain/constants/events.constant';
import { Review } from '@/interactions/domain/entities/review';
import { RatingScore } from '@/interactions/domain/value-objects/rating-score.vo';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@books/application/ports/book-repository.interface';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';

@Injectable()
export class ReviewBookUseCase {
	constructor(
		@Inject('ReviewRepository')
		private readonly reviewRepository: ReviewRepository,
		private readonly eventEmitter: EventEmitter2,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly userAccessPolicyService: UserAccessPolicyService,
	) {}

	async execute(
		userId: string,
		bookId: string,
		rating: number,
		content: string,
		maxWeightSensitiveContent: number,
	): Promise<void> {
		const user = UserId.create(userId);

		const bookMetadata = await this.bookRepository.findById(bookId, [
			'tags',
			'sensitiveContent',
		]);
		if (!bookMetadata) {
			throw new NotFoundException('Book not found');
		}

		const access = await this.userAccessPolicyService.evaluateAccessForBook(
			{
				userId,
				bookId: bookMetadata.id,
				bookTagIds: (bookMetadata.tags || []).map((t) => t.id),
				bookSensitiveContentIds: (
					bookMetadata.sensitiveContent || []
				).map((sc) => sc.id),
				bookSensitiveContentWeights: (
					bookMetadata.sensitiveContent || []
				).map((sc) => sc.weight),
				baseMaxWeightSensitiveContent: maxWeightSensitiveContent,
			},
		);

		if (access.blocked) {
			throw new ForbiddenException(
				'You do not have permission to interact with this book.',
			);
		}

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
