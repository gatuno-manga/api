import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { Collection } from '@/collections/domain/entities/collection';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { CollectionEntity } from '@/collections/infrastructure/database/entities/collection.entity';
import { CollectionMapper } from '@/collections/infrastructure/mappers/collection.mapper';
import { User } from '@users/infrastructure/database/entities/user.entity';
import { Book } from '@books/infrastructure/database/entities/book.entity';

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
		return entities.map(CollectionMapper.toDomain);
	}

	async findSharedWith(userId: UserId): Promise<Collection[]> {
		const entities = await this.repository
			.createQueryBuilder('collection')
			.leftJoinAndSelect('collection.collaborators', 'collaborator')
			.leftJoinAndSelect('collection.books', 'book')
			.where('collaborator.id = :userId', { userId: userId.toString() })
			.getMany();
		return entities.map(CollectionMapper.toDomain);
	}

	async delete(id: CollectionId): Promise<void> {
		await this.repository.delete(id.toString());
	}
}
