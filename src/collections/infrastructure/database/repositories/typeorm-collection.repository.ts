import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { Collection } from '@/collections/domain/entities/collection';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { CollectionEntity } from '@/collections/infrastructure/database/entities/collection.entity';
import { CollectionMapper } from '@/collections/infrastructure/mappers/collection.mapper';
import { SyncState } from '@/sync/application/types/sync-state.enum';
import { Book } from '@books/infrastructure/database/entities/book.entity';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { FindOptionsWhere, In, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class TypeOrmCollectionRepository implements CollectionRepository {
	constructor(
		@InjectRepository(CollectionEntity)
		private readonly repository: Repository<CollectionEntity>,
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@InjectRepository(Book)
		private readonly bookRepository: Repository<Book>,
	) {}

	async create(collection: Collection): Promise<void> {
		const snapshot = collection.toSnapshot();
		const entity = new CollectionEntity();
		entity.id = snapshot.id;
		entity.ownerId = snapshot.ownerId;
		entity.title = snapshot.title;
		entity.description = snapshot.description;
		entity.visibility = snapshot.visibility;

		try {
			await this.repository.insert({
				id: entity.id,
				ownerId: entity.ownerId,
				title: entity.title,
				description: entity.description,
				visibility: entity.visibility,
			});
		} catch (error: unknown) {
			const err = error as { code?: string; number?: number };
			if (err?.code === 'ER_DUP_ENTRY' || err?.number === 1062) {
				throw new DomainException(
					'Collection with this ID already exists',
				);
			}
			throw error;
		}
	}

	async save(collection: Collection): Promise<void> {
		const snapshot = collection.toSnapshot();
		let entity = await this.repository.findOne({
			where: { id: snapshot.id },
			relations: ['collaborators', 'books'],
		});

		if (!entity) {
			entity = new CollectionEntity();
			entity.id = snapshot.id;
		}

		entity.ownerId = snapshot.ownerId;
		entity.title = snapshot.title;
		entity.description = snapshot.description;
		entity.visibility = snapshot.visibility;

		// Handle collaborators
		if (snapshot.collaborators.length > 0) {
			entity.collaborators = await this.userRepository.find({
				where: { id: In(snapshot.collaborators) },
			});
		} else {
			entity.collaborators = [];
		}

		// Handle books
		if (snapshot.books.length > 0) {
			entity.books = await this.bookRepository.find({
				where: { id: In(snapshot.books) },
			});
		} else {
			entity.books = [];
		}

		await this.repository.save(entity);
	}

	async findById(id: CollectionId): Promise<Collection | null> {
		const entity = await this.repository.findOne({
			where: { id: id.toString() },
			relations: ['collaborators', 'books'],
		});
		return entity ? CollectionMapper.toDomain(entity) : null;
	}

	async findByOwner(ownerId: UserId): Promise<Collection[]> {
		const entities = await this.repository.find({
			where: { ownerId: ownerId.toString() },
			relations: ['collaborators', 'books'],
		});
		return entities.map((entity) => CollectionMapper.toDomain(entity));
	}

	async findSharedWith(userId: UserId): Promise<Collection[]> {
		const entities = await this.repository
			.createQueryBuilder('collection')
			.leftJoinAndSelect('collection.collaborators', 'collaborator')
			.leftJoinAndSelect('collection.books', 'book')
			.where('collaborator.id = :userId', { userId: userId.toString() })
			.getMany();
		return entities.map((entity) => CollectionMapper.toDomain(entity));
	}

	async findPaginatedByOwner(
		ownerId: UserId,
		limit: number,
		cursorCreatedAt?: Date,
		cursorId?: string,
	): Promise<Collection[]> {
		const qb = this.repository
			.createQueryBuilder('collection')
			.leftJoinAndSelect('collection.collaborators', 'collaborator')
			.leftJoinAndSelect('collection.books', 'book')
			.where('collection.ownerId = :ownerId', {
				ownerId: ownerId.toString(),
			})
			.orderBy('collection.createdAt', 'DESC')
			.addOrderBy('collection.id', 'DESC');

		if (cursorCreatedAt && cursorId) {
			qb.andWhere(
				'(collection.createdAt < :cursorCreatedAt OR (collection.createdAt = :cursorCreatedAt AND collection.id < :cursorId))',
				{ cursorCreatedAt, cursorId },
			);
		}

		qb.take(limit + 1);

		const entities = await qb.getMany();
		return entities.map((entity) => CollectionMapper.toDomain(entity));
	}

	async findByOwnerWithOffset(
		ownerId: UserId,
		skip: number,
		take: number,
	): Promise<[Collection[], number]> {
		const [entities, count] = await this.repository.findAndCount({
			where: { ownerId: ownerId.toString() },
			relations: ['collaborators', 'books'],
			order: { createdAt: 'DESC', id: 'DESC' },
			skip,
			take,
		});

		return [
			entities.map((entity) => CollectionMapper.toDomain(entity)),
			count,
		];
	}

	async delete(id: CollectionId): Promise<void> {
		await this.repository.softDelete(id.toString());
	}

	async restore(
		id: CollectionId,
		title: string,
		description?: string,
	): Promise<void> {
		const entity = await this.repository.findOne({
			where: { id: id.toString() },
			withDeleted: true,
		});

		if (!entity || !entity.deletedAt) {
			return;
		}

		entity.deletedAt = null;
		entity.title = title;
		entity.description = description ?? null;
		await this.repository.save(entity);
	}

	async findByOwnerForSync(
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
	> {
		const where: FindOptionsWhere<CollectionEntity> = {
			ownerId: ownerId.toString(),
		};
		if (lastSyncAt) {
			where.updatedAt = MoreThanOrEqual(lastSyncAt);
		}
		const entities = await this.repository.find({
			where,
			withDeleted: !!lastSyncAt,
		});
		return entities.map((e) => ({
			id: e.id,
			title: e.title,
			description: e.description,
			visibility: e.visibility,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt,
			deletedAt: e.deletedAt,
		}));
	}

	async getSyncState(id: CollectionId): Promise<SyncState> {
		const entity = await this.repository.findOne({
			where: { id: id.toString() },
			withDeleted: true,
		});
		if (!entity) return SyncState.NOT_FOUND;
		if (entity.deletedAt) return SyncState.DELETED;
		return SyncState.ACTIVE;
	}
}
