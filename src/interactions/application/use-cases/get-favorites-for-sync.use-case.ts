import { FavoriteRepository } from '@/interactions/application/ports/favorite-repository.port';
import { SyncFavoriteDto } from '@/sync/infrastructure/http/dto/push-sync-request.dto';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class GetFavoritesForSyncUseCase {
	constructor(
		@Inject('FavoriteRepository')
		private readonly favoriteRepository: FavoriteRepository,
	) {}

	async execute(
		userId: UserId,
		lastSyncAt?: Date,
	): Promise<SyncFavoriteDto[]> {
		const favorites = await this.favoriteRepository.findByUserForSync(
			userId,
			lastSyncAt,
		);

		return favorites.map((f) => {
			const snap = f.toSnapshot();
			return {
				bookId: snap.bookId,
				createdAt: snap.createdAt,
				updatedAt: snap.updatedAt,
				deletedAt: snap.deletedAt?.toISOString() ?? undefined,
			};
		});
	}
}
