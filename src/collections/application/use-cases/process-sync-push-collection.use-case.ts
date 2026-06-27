import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { SyncState } from '@/sync/application/types/sync-state.enum';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';
import { CollectionRepository } from '../ports/collection-repository.port';
import { CreateCollectionUseCase } from './create-collection.use-case';
import { DeleteCollectionUseCase } from './delete-collection.use-case';
import { RestoreCollectionUseCase } from './restore-collection.use-case';
import { UpdateCollectionUseCase } from './update-collection.use-case';

export interface SyncPushCollectionPayload {
	id: string;
	title: string;
	description?: string;
	deletedAt?: string;
}

@Injectable()
export class ProcessSyncPushCollectionUseCase {
	constructor(
		@Inject('CollectionRepository')
		private readonly collectionRepository: CollectionRepository,
		private readonly createCollectionUseCase: CreateCollectionUseCase,
		private readonly deleteCollectionUseCase: DeleteCollectionUseCase,
		private readonly restoreCollectionUseCase: RestoreCollectionUseCase,
		private readonly updateCollectionUseCase: UpdateCollectionUseCase,
	) {}

	async execute(
		userId: string,
		payload: SyncPushCollectionPayload,
	): Promise<void> {
		if (payload.deletedAt && payload.id) {
			await this.deleteCollectionUseCase.execute(userId, payload.id);
			return;
		}

		const collectionId = CollectionId.create(payload.id);
		const state =
			await this.collectionRepository.getSyncState(collectionId);

		if (state === SyncState.DELETED) {
			await this.restoreCollectionUseCase.execute(
				collectionId,
				payload.title,
				payload.description,
			);
		} else if (state === SyncState.NOT_FOUND) {
			await this.createCollectionUseCase.execute(
				userId,
				payload.title,
				payload.description,
				payload.id,
			);
		} else if (state === SyncState.ACTIVE) {
			await this.updateCollectionUseCase.execute(
				userId,
				collectionId.toString(),
				{
					title: payload.title,
					description: payload.description,
				},
			);
		}
	}
}
