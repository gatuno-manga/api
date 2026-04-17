import { Global, Module } from '@nestjs/common';
import { UserAwareCacheInterceptor } from './interceptors/user-aware-cache.interceptor';
import { CacheInvalidationService } from './services/cache-invalidation.service';

/**
 * Global module providing common services across the application
 */
@Global()
@Module({
	providers: [CacheInvalidationService, UserAwareCacheInterceptor],
	exports: [CacheInvalidationService, UserAwareCacheInterceptor],
})
export class CommonModule {}
