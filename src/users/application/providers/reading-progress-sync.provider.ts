import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { SyncRegistry } from '@/sync/application/services/sync.registry';
import { SyncFeature } from '@/sync/application/types/sync-feature.enum';
import { ISyncProvider } from '@/sync/application/types/sync-provider.interface';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
	SaveReadingProgressDto,
	SyncReadingProgressDto,
} from '@users/infrastructure/http/dto/reading-progress.dto';
import { ReadingProgressService } from '../use-cases/reading-progress.service';

@Injectable()
export class ReadingProgressSyncProvider
	implements ISyncProvider<SaveReadingProgressDto>, OnModuleInit
{
	constructor(
		private readonly syncRegistry: SyncRegistry,
		private readonly readingProgressService: ReadingProgressService,
	) {}

	onModuleInit() {
		this.syncRegistry.register(this);
	}

	getFeatureName(): SyncFeature {
		return SyncFeature.READING_PROGRESS;
	}

	async pull(
		user: CurrentUserDto,
		lastSyncAt?: Date,
	): Promise<SaveReadingProgressDto[]> {
		const syncDto: SyncReadingProgressDto = {
			progress: [],
			lastSyncAt: lastSyncAt,
		};
		const result = await this.readingProgressService.syncProgress(
			user.userId,
			syncDto,
		);
		return result.synced;
	}

	async push(
		user: CurrentUserDto,
		data: SaveReadingProgressDto[],
	): Promise<void> {
		const syncDto: SyncReadingProgressDto = {
			progress: data,
		};
		await this.readingProgressService.syncProgress(user.userId, syncDto);
	}
}
