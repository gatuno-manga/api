import { Injectable } from '@nestjs/common';
import { HighestPageWinsStrategy } from './highest-page-wins.strategy';
import { LastWriteWinsStrategy } from './last-write-wins.strategy';
import { SyncResolutionContext, SyncStrategy } from './sync-strategy.interface';

@Injectable()
export class SyncStrategyResolver {
	constructor(
		private readonly lastWriteWinsStrategy: LastWriteWinsStrategy,
		private readonly highestPageWinsStrategy: HighestPageWinsStrategy,
	) {}

	resolve(context: SyncResolutionContext): SyncStrategy {
		if (this.lastWriteWinsStrategy.canHandle(context)) {
			return this.lastWriteWinsStrategy;
		}

		return this.highestPageWinsStrategy;
	}
}
