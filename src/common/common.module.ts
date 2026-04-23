import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../infrastructure/app-config/app-config.module';
import { UserAwareCacheInterceptor } from './interceptors/user-aware-cache.interceptor';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { MediaUrlService } from './services/media-url.service';

/**
 * Global module providing common services across the application
 */
@Global()
@Module({
	imports: [AppConfigModule],
	providers: [
		CacheInvalidationService,
		UserAwareCacheInterceptor,
		MediaUrlService,
	],
	exports: [
		CacheInvalidationService,
		UserAwareCacheInterceptor,
		MediaUrlService,
	],
})
export class CommonModule {}
