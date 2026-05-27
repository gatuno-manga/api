import { AppConfigModule } from '@app-config/app-config.module';
import { Global, Module } from '@nestjs/common';
import { LanguagesController } from './infrastructure/http/controllers/languages.controller';
import { UserAwareCacheInterceptor } from './interceptors/user-aware-cache.interceptor';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { MediaUrlService } from './services/media-url.service';

/**
 * Global module providing common services across the application
 */
@Global()
@Module({
	imports: [AppConfigModule],
	controllers: [LanguagesController],
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
