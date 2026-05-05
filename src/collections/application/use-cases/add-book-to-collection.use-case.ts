import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { BookId } from '@common/domain/value-objects/book-id.vo';

@Injectable()
export class AddBookToCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		userId: string,
		collectionId: string,
		bookId: string,
	): Promise<void> {
		const user = UserId.create(userId);
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
