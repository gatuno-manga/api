import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { Favorite } from '@/interactions/domain/entities/favorite';
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
export class FavoriteBookUseCase {
	constructor(
		@Inject('FavoriteRepository')
		private readonly favoriteRepository: FavoriteRepository,
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
		const favorite = Favorite.create(user, book);
		await this.favoriteRepository.save(favorite);
	}
}
