import { Collection } from '@/collections/domain/entities/collection';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { SyncState } from '@/sync/application/types/sync-state.enum';
import { UserId } from '@common/domain/value-objects/user-id.vo';

export interface CollectionRepository {
	create(collection: Collection): Promise<void>;
	save(collection: Collection): Promise<void>;
	findById(id: CollectionId): Promise<Collection | null>;
	findByOwner(ownerId: UserId): Promise<Collection[]>;
	findPaginatedByOwner(
		ownerId: UserId,
		limit: number,
		cursorCreatedAt?: Date,
		cursorId?: string,
	): Promise<Collection[]>;
	findByOwnerWithOffset(
		ownerId: UserId,
		skip: number,
		take: number,
	): Promise<[Collection[], number]>;
	findSharedWith(userId: UserId): Promise<Collection[]>;
	delete(id: CollectionId): Promise<void>;
	restore(
		id: CollectionId,
		title: string,
		description?: string,
	): Promise<void>;
	findByOwnerForSync(
		ownerId: UserId,
		lastSyncAt?: Date,
	): Promise<
		{
			id: string;
			title: string;
			description: string | null;
			visibility: string;
			createdAt: Date;
			updatedAt: Date;
			deletedAt: Date | null;
		}[]
	>;
	getSyncState(id: CollectionId): Promise<SyncState>;
}
