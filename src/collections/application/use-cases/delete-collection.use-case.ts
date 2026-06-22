import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class DeleteCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async execute(requesterId: string, collectionId: string): Promise<void> {
		const targetId = CollectionId.create(collectionId);
		const collection = await this.collectionRepository.findById(targetId);

		if (!collection) {
			throw new ResourceNotFoundException('Collection not found');
		}

		collection.verifyOwner(UserId.create(requesterId));

		await this.collectionRepository.delete(targetId);
		this.eventEmitter.emit(CollectionEvents.DELETED, collection);
	}
}
