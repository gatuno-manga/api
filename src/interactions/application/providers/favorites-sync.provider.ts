import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { SyncFeature } from '@/sync/application/types/sync-feature.enum';
import { ISyncProvider } from '@/sync/application/types/sync-provider.interface';
import { SyncFavoriteDto } from '@/sync/infrastructure/http/dto/push-sync-request.dto';
import { BookId } from '@common/domain/value-objects/book-id.vo';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FavoriteBookUseCase } from '../use-cases/favorite-book.use-case';
import { GetFavoritesForSyncUseCase } from '../use-cases/get-favorites-for-sync.use-case';
import { UnfavoriteBookUseCase } from '../use-cases/unfavorite-book.use-case';

@Injectable()
export class FavoritesSyncProvider
	implements ISyncProvider<SyncFavoriteDto>, OnModuleInit
{
	private readonly logger = new Logger(FavoritesSyncProvider.name);

	constructor(
		private readonly syncRegistry: SyncRegistry,
		private readonly getFavoritesForSyncUseCase: GetFavoritesForSyncUseCase,
		private readonly favoriteBookUseCase: FavoriteBookUseCase,
		private readonly unfavoriteBookUseCase: UnfavoriteBookUseCase,
	) {}

	onModuleInit() {
		this.syncRegistry.register(this);
	}

	getFeatureName(): SyncFeature {
		return SyncFeature.FAVORITES;
	}

	async pull(
		user: CurrentUserDto,
		lastSyncAt?: Date,
	): Promise<SyncFavoriteDto[]> {
		return this.getFavoritesForSyncUseCase.execute(
			UserId.create(user.userId),
			lastSyncAt,
		);
	}

	async push(user: CurrentUserDto, data: SyncFavoriteDto[]): Promise<void> {
		const userId = UserId.create(user.userId);
		for (const favorite of data) {
			try {
				if (favorite.deletedAt) {
					await this.unfavoriteBookUseCase.execute(
						userId,
						BookId.create(favorite.bookId),
					);
					continue;
				}
				await this.favoriteBookUseCase.execute(
					user.userId,
					favorite.bookId,
					user.maxWeightSensitiveContent ?? 0,
				);
			} catch (error) {
				this.logger.error(
					`Error syncing favorite: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
