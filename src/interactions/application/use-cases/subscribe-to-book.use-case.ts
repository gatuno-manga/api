import { SubscriptionRepository } from '@/interactions/application/ports/subscription-repository.port';
import { Subscription } from '@/interactions/domain/entities/subscription';
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
import { UserAccessPolicyService } from 'src/users/application/use-cases/user-access-policy.service';

@Injectable()
export class SubscribeToBookUseCase {
	constructor(
		@Inject('SubscriptionRepository')
		private readonly subscriptionRepository: SubscriptionRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly userAccessPolicyService: UserAccessPolicyService,
	) {}

	async execute(
		userId: string,
		bookId: string,
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
		const subscription = Subscription.create(user, book);
		await this.subscriptionRepository.save(subscription);
	}
}
