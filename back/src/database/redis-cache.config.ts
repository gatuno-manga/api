import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { CacheableMemory, Keyv } from 'cacheable';
import { createKeyv } from '@keyv/redis';

export const config = (
    configService: AppConfigService,
): CacheModuleAsyncOptions => ({
    isGlobal: true,
    imports: [AppConfigModule],
    inject: [AppConfigService],
    useFactory: async (configService: AppConfigService) => {
        const password = configService.redis.password ? `:${configService.redis.password}@` : '';
        const redisUrl = `redis://${password}${configService.redis.host}:${configService.redis.port}`;
        return {
            stores: [
                new Keyv({
                    store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
                }),
                createKeyv(redisUrl),
            ]
        };
    },
});
