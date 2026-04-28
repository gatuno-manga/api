import { Collection } from '../../domain/entities/collection';
import { CollectionId } from '../../domain/value-objects/collection-id.vo';
import { UserId } from '../../../common/domain/value-objects/user-id.vo';

export interface CollectionRepository {
	save(collection: Collection): Promise<void>;
	findById(id: CollectionId): Promise<Collection | null>;
	findByOwner(ownerId: UserId): Promise<Collection[]>;
	findSharedWith(userId: UserId): Promise<Collection[]>;
	delete(id: CollectionId): Promise<void>;
}
