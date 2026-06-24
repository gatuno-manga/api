import { CollectionRepository } from '@/collections/application/ports/collection-repository.port';
import { CollectionEvents } from '@/collections/domain/constants/events.constant';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { Visibility } from '@/collections/domain/value-objects/visibility.vo';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UpdateCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async execute(
		requesterId: string,
		collectionId: string,
		updateData: {
			title?: string;
			description?: string | null;
			isPublic?: boolean;
			coverUrl?: string | null;
		},
	): Promise<void> {
		const collection = await this.collectionRepository.findById(
			CollectionId.create(collectionId),
		);

		if (!collection) {
			throw new ResourceNotFoundException('Collection not found');
		}

		const user = UserId.create(requesterId);

		if (updateData.title !== undefined) {
			collection.updateTitle(user, updateData.title);
		}

		if (updateData.description !== undefined) {
			collection.updateDescription(user, updateData.description);
		}

		if (updateData.isPublic !== undefined) {
			collection.updateVisibility(
				user,
				updateData.isPublic
					? Visibility.public()
					: Visibility.private(),
			);
		}

		if (updateData.coverUrl !== undefined) {
			collection.updateCoverUrl(user, updateData.coverUrl);
		}

		await this.collectionRepository.save(collection);

		this.eventEmitter.emit(CollectionEvents.UPDATED, {
			collectionId: collectionId,
			userId: requesterId,
		});
	}
}
