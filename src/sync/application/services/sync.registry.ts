import { Injectable, Logger } from '@nestjs/common';
import { SyncFeature } from '../types/sync-feature.enum';
import { ISyncProvider } from '../types/sync-provider.interface';

@Injectable()
export class SyncRegistry {
	private readonly logger = new Logger(SyncRegistry.name);
	private providers = new Map<SyncFeature, ISyncProvider>();

	register(provider: ISyncProvider) {
		const featureName = provider.getFeatureName();
		if (this.providers.has(featureName)) {
			this.logger.warn(
				`Provider for feature ${featureName} is being overwritten.`,
			);
		}
		this.providers.set(featureName, provider);
		this.logger.log(`Registered sync provider for feature: ${featureName}`);
	}

	getProvider(feature: SyncFeature): ISyncProvider | undefined {
		return this.providers.get(feature);
	}

	getAllProviders(): ISyncProvider[] {
		return Array.from(this.providers.values());
	}
}
