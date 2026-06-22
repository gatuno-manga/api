import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { Collection } from '@/collections/domain/entities/collection';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { DomainException } from '@common/domain/exceptions/domain.exception';
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
		if (id) {
			const existing = await this.collectionRepository.findById(
				CollectionId.create(id),
			);
			if (existing) {
				throw new DomainException(
					'Collection with this ID already exists',
				);
			}
		}

		const owner = UserId.create(ownerId);
		const collection = Collection.create(owner, title, description, id);
		await this.collectionRepository.save(collection);
		this.eventEmitter.emit(CollectionEvents.CREATED, collection);
	}
}
