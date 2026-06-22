import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
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
export class AddBookToCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
		private readonly userAccessPolicyService: UserAccessPolicyService,
	) {}

	async execute(
		userId: string,
		collectionId: string,
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

		const collection = await this.collectionRepository.findById(
			CollectionId.create(collectionId),
		);

		if (!collection) {
			throw new NotFoundException('Collection not found');
		}

		collection.addBook(user, BookId.create(bookId));
		await this.collectionRepository.save(collection);
	}
}
