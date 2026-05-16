import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';

@Injectable()
export class ShareCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		ownerId: string,
		collectionId: string,
		collaboratorId: string,
	): Promise<void> {
		const owner = UserId.create(ownerId);
		const collaborator = UserId.create(collaboratorId);
		const collection = await this.collectionRepository.findById(
			CollectionId.create(collectionId),
		);

		if (!collection) {
			throw new NotFoundException('Collection not found');
		}

		collection.addCollaborator(owner, collaborator);
		await this.collectionRepository.save(collection);
	}
}
