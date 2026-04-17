import { Injectable } from '@nestjs/common';
import { SaveReadingProgressDto } from '../dto/reading-progress.dto';
import { ReadingProgress } from '../entities/reading-progress.entity';
import {
	SyncResolution,
	SyncResolutionContext,
	SyncStrategy,
} from './sync-strategy.interface';

@Injectable()
export class HighestPageWinsStrategy implements SyncStrategy {
	readonly name = 'HighestPageWinsStrategy';

	canHandle(context: SyncResolutionContext): boolean {
		return !context.lastSyncAt;
	}

	resolve(
		local: SaveReadingProgressDto,
		remote: ReadingProgress,
		_context: SyncResolutionContext,
	): SyncResolution {
		return local.pageIndex >= remote.pageIndex ? 'local' : 'remote';
	}
}
