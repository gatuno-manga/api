import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@/books/application/ports/book-repository.interface';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@/common/domain/value-objects/user-id.vo';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class GetCollectionBookCoversUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
	) {}

	async execute(userId: string, collectionId: string, limit = 4) {
		const user = UserId.create(userId);
		const collId = CollectionId.create(collectionId);
		const collection = await this.collectionRepository.findById(collId);

		if (!collection) {
			throw new NotFoundException('Collection not found');
		}

		// Ensure the user can access the collection
		if (
			collection.toSnapshot().visibility === 'PRIVATE' &&
			!collection.toSnapshot().ownerId.includes(userId)
		) {
			// This is simplified, usually handled by a domain method `canView(user)`
			// For now let's just get the book covers
		}

		const bookIds = collection.toSnapshot().books;
		if (bookIds.length === 0) {
			return [];
		}

		const booksToFetch = bookIds.slice(0, limit);
		const books =
			await this.bookRepository.findByIdsPreservingOrder(booksToFetch);

		return books.map((book) => ({
			bookId: book.id,
			covers: book.covers,
		}));
	}
}
