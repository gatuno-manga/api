import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { redisStore } from 'cache-manager-redis-store';

export const config = (
    configService: AppConfigService,
): CacheModuleAsyncOptions => ({
    isGlobal: true,
    imports: [AppConfigModule],
    inject: [AppConfigService],
    useFactory: async (configService: AppConfigService) => {
        const store = await redisStore({
            socket: {
                host: configService.redis.host,
                port: configService.redis.port,
            },
        });
        return {
            store,
        };
    },
});
