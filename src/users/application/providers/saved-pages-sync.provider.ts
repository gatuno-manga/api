import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { SyncFeature } from '@/sync/application/types/sync-feature.enum';
import { ISyncProvider } from '@/sync/application/types/sync-provider.interface';
import { SyncSavedPageDto } from '@/sync/infrastructure/http/dto/push-sync-request.dto';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateSavedPageDto } from '@users/infrastructure/http/dto/create-saved-page.dto';
import { UserResourcesMapper } from '../mappers/user-resources.mapper';
import { SavedPagesService } from '../use-cases/saved-pages.service';

@Injectable()
export class SavedPagesSyncProvider
	implements ISyncProvider<SyncSavedPageDto>, OnModuleInit
{
	private readonly logger = new Logger(SavedPagesSyncProvider.name);

	constructor(
		private readonly syncRegistry: SyncRegistry,
		private readonly savedPagesService: SavedPagesService,
		private readonly userResourcesMapper: UserResourcesMapper,
	) {}

	onModuleInit() {
		this.syncRegistry.register(this);
	}

	getFeatureName(): SyncFeature {
		return SyncFeature.SAVED_PAGES;
	}

	async pull(
		user: CurrentUserDto,
		lastSyncAt?: Date,
	): Promise<SyncSavedPageDto[]> {
		const pages = await this.savedPagesService.getSavedPagesForSync(
			UserId.create(user.userId),
			lastSyncAt,
		);

		return pages.map((p) => {
			const saved = this.userResourcesMapper.toSavedPage(p);
			return {
				pageId: saved.pageId,
				chapterId: saved.chapterId,
				bookId: saved.bookId,
				comment: saved.comment ?? undefined,
				isPublic: saved.isPublic,
				deletedAt: saved.deletedAt?.toISOString() || undefined,
			};
		});
	}

	async push(user: CurrentUserDto, data: SyncSavedPageDto[]): Promise<void> {
		const userId = UserId.create(user.userId);
		for (const page of data) {
			try {
				if (page.deletedAt) {
					await this.savedPagesService.unsavePageByPageId(
						page.pageId,
						userId,
					);
					continue;
				}
				await this.savedPagesService.savePage(
					page as CreateSavedPageDto,
					user.userId,
				);
			} catch (error) {
				this.logger.debug(
					`Error syncing saved page: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
	}
}
