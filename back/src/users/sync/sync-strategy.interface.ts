import { SaveReadingProgressDto } from '../dto/reading-progress.dto';
import { ReadingProgress } from '../entities/reading-progress.entity';

export type SyncResolution = 'local' | 'remote' | 'conflict';

export interface SyncResolutionContext {
	lastSyncAt?: Date;
}

export interface SyncStrategy {
	readonly name: string;

	canHandle(context: SyncResolutionContext): boolean;

	resolve(
		local: SaveReadingProgressDto,
		remote: ReadingProgress,
		context: SyncResolutionContext,
	): SyncResolution;
}
