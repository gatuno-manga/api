import { Inject, Injectable } from '@nestjs/common';
import { CollectionRepository } from '../ports/collection-repository.port';
import { Collection } from '../../domain/entities/collection';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';

@Injectable()
export class CreateCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		ownerId: string,
		title: string,
		description?: string,
	): Promise<void> {
		const owner = UserId.create(ownerId);
		const collection = Collection.create(owner, title, description);
		await this.collectionRepository.save(collection);
	}
}
