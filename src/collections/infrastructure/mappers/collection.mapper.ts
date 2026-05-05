import { CollectionEntity } from '@/collections/infrastructure/database/entities/collection.entity';
import {
	Collection,
	CollectionSnapshot,
} from '@/collections/domain/entities/collection';

export const CollectionMapper = {
	toDomain(entity: CollectionEntity): Collection {
		const snapshot: CollectionSnapshot = {
			id: entity.id,
			ownerId: entity.ownerId,
			title: entity.title,
			description: entity.description,
			visibility: entity.visibility,
			collaborators: entity.collaborators?.map((u) => u.id) ?? [],
			books: entity.books?.map((b) => b.id) ?? [],
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt,
		};
		return Collection.restore(snapshot);
	},

	toEntity(domain: Collection): CollectionEntity {
		const snapshot = domain.toSnapshot();
		const entity = new CollectionEntity();
		entity.id = snapshot.id;
		entity.ownerId = snapshot.ownerId;
		entity.title = snapshot.title;
		entity.description = snapshot.description;
		entity.visibility = snapshot.visibility;
		entity.createdAt = snapshot.createdAt;
		entity.updatedAt = snapshot.updatedAt;
		return entity;
	},
};
