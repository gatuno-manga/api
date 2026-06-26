import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { SyncCollectionDto } from '@/sync/infrastructure/http/dto/push-sync-request.dto';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class GetCollectionsForSyncUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
	) {}

	async execute(
		userId: UserId,
		lastSyncAt?: Date,
	): Promise<SyncCollectionDto[]> {
		const collections = await this.collectionRepository.findByOwnerForSync(
			userId,
			lastSyncAt,
		);

		return collections.map((c) => ({
			id: c.id,
			title: c.title,
			description: c.description ?? undefined,
			visibility: c.visibility,
			createdAt: c.createdAt,
			updatedAt: c.updatedAt,
			deletedAt: c.deletedAt?.toISOString() ?? undefined,
		}));
	}
}
