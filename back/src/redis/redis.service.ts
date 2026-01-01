import { Injectable, Logger, OnModuleDestroy, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
        this.logger.log('✅ Redis service initialized');
    }

    getClient(): Redis {
        return this.redis;
    }

    async onModuleDestroy() {
        this.logger.log('Disconnecting from Redis...');
        await this.redis.quit();
    }
}
