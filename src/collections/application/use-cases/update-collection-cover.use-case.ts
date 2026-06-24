import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@/common/domain/value-objects/user-id.vo';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UpdateCollectionCoverUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		userId: string,
		collectionId: string,
		coverUrl: string | null,
	): Promise<void> {
		const user = UserId.create(userId);
		const collId = CollectionId.create(collectionId);
		const collection = await this.collectionRepository.findById(collId);

		if (!collection) {
			throw new NotFoundException('Collection not found');
		}

		collection.updateCoverUrl(user, coverUrl);
		await this.collectionRepository.save(collection);
	}
}
