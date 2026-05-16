import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { Collection } from '@/collections/domain/entities/collection';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';

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
	): Promise<void> {
		const owner = UserId.create(ownerId);
		const collection = Collection.create(owner, title, description);
		await this.collectionRepository.save(collection);
		this.eventEmitter.emit(CollectionEvents.CREATED, collection);
	}
}
