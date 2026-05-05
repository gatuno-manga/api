import { Inject, Injectable } from '@nestjs/common';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Collection } from '@/collections/domain/entities/collection';

@Injectable()
export class GetUserCollectionsUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(userId: string): Promise<Collection[]> {
		return this.collectionRepository.findByOwner(UserId.create(userId));
	}
}
