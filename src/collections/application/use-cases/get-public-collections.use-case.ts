import { Inject, Injectable } from '@nestjs/common';
import { CollectionRepository } from '../ports/collection-repository.port';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';
import { Collection } from '../../domain/entities/collection';

@Injectable()
export class GetPublicCollectionsUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(userId: string): Promise<Collection[]> {
		const collections = await this.collectionRepository.findByOwner(
			UserId.create(userId),
		);
		return collections.filter(
			(c) => c.toSnapshot().visibility === 'PUBLIC',
		);
	}
}
