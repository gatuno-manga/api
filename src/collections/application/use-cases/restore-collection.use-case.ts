import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Restores a soft-deleted collection during sync push.
 * Delegates to CollectionRepository.restore so infrastructure handles
 * the deletedAt nullification without leaking ORM logic into the provider.
 */
@Injectable()
export class RestoreCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		collectionId: CollectionId,
		title: string,
		description?: string,
	): Promise<void> {
		await this.collectionRepository.restore(
			collectionId,
			title,
			description,
		);
	}
}
