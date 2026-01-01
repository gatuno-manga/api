import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { CacheableMemory, Keyv } from 'cacheable';
import { createKeyv } from '@keyv/redis';

export const config: CacheModuleAsyncOptions = {
    isGlobal: true,
    imports: [AppConfigModule],
    inject: [AppConfigService],
    useFactory: async (configService: AppConfigService) => {
        const { host, port, password } = configService.redis;
        const redisUrl = password
            ? `redis://:${password}@${host}:${port}`
            : `redis://${host}:${port}`;

        return {
            stores: [
                new Keyv({
                    store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
                }),
                createKeyv(redisUrl),
            ],
        };
    },
};
