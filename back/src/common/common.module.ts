import { Module, Global } from '@nestjs/common';
import { CacheInvalidationService } from './services/cache-invalidation.service';

/**
 * Global module providing common services across the application
 */
@Global()
@Module({
    providers: [CacheInvalidationService],
    exports: [CacheInvalidationService],
})
export class CommonModule {}
