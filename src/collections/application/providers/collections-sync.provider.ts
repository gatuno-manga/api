import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { CollectionId } from '@/collections/domain/value-objects/collection-id.vo';
import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { SyncFeature } from '@/sync/application/types/sync-feature.enum';
import { ISyncProvider } from '@/sync/application/types/sync-provider.interface';
import { SyncCollectionDto } from '@/sync/infrastructure/http/dto/push-sync-request.dto';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GetCollectionsForSyncUseCase } from '../use-cases/get-collections-for-sync.use-case';
import { ProcessSyncPushCollectionUseCase } from '../use-cases/process-sync-push-collection.use-case';

@Injectable()
export class CollectionsSyncProvider
	implements ISyncProvider<SyncCollectionDto>, OnModuleInit
{
	private readonly logger = new Logger(CollectionsSyncProvider.name);

	constructor(
		private readonly syncRegistry: SyncRegistry,
		private readonly getCollectionsForSyncUseCase: GetCollectionsForSyncUseCase,
		private readonly processSyncPushCollectionUseCase: ProcessSyncPushCollectionUseCase,
	) {}

	onModuleInit() {
		this.syncRegistry.register(this);
	}

	getFeatureName(): SyncFeature {
		return SyncFeature.COLLECTIONS;
	}

	async pull(
		user: CurrentUserDto,
		lastSyncAt?: Date,
	): Promise<SyncCollectionDto[]> {
		return this.getCollectionsForSyncUseCase.execute(
			UserId.create(user.userId),
			lastSyncAt,
		);
	}

	async push(user: CurrentUserDto, data: SyncCollectionDto[]): Promise<void> {
		for (const col of data) {
			try {
				await this.processSyncPushCollectionUseCase.execute(
					user.userId,
					{
						id: col.id,
						title: col.title,
						description: col.description,
						deletedAt: col.deletedAt,
					},
				);
			} catch (error) {
				this.logger.error(
					`Error syncing collection: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
