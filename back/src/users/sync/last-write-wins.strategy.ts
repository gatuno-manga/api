import { Injectable } from '@nestjs/common';
import { SaveReadingProgressDto } from '../dto/reading-progress.dto';
import { ReadingProgress } from '../entities/reading-progress.entity';
import {
	SyncResolution,
	SyncResolutionContext,
	SyncStrategy,
} from './sync-strategy.interface';

@Injectable()
export class LastWriteWinsStrategy implements SyncStrategy {
	readonly name = 'LastWriteWinsStrategy';

	canHandle(context: SyncResolutionContext): boolean {
		return Boolean(context.lastSyncAt);
	}

	resolve(
		local: SaveReadingProgressDto,
		remote: ReadingProgress,
		context: SyncResolutionContext,
	): SyncResolution {
		if (!context.lastSyncAt) {
			return 'local';
		}

		const remoteUpdatedAt = new Date(remote.updatedAt);
		if (remoteUpdatedAt > context.lastSyncAt) {
			if (local.pageIndex !== remote.pageIndex) {
				return 'conflict';
			}

			return 'remote';
		}

		return 'local';
	}
}
