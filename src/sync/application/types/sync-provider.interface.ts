import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { SyncFeature } from './sync-feature.enum';

export interface ISyncProvider<T = unknown> {
	getFeatureName(): SyncFeature;
	pull(user: CurrentUserDto, lastSyncAt?: Date): Promise<T[]>;
	push(user: CurrentUserDto, data: T[]): Promise<void>;
}
