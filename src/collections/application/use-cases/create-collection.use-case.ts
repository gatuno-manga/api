import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { Collection } from '@/collections/domain/entities/collection';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class CreateCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async execute(
		ownerId: string,
		title: string,
		description?: string,
		id?: string,
	): Promise<void> {
		const owner = UserId.create(ownerId);
		const collection = Collection.create(owner, title, description, id);
		await this.collectionRepository.save(collection);
		this.eventEmitter.emit(CollectionEvents.CREATED, collection);
	}
}
