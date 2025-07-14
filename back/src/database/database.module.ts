import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { config as primaryDatabaseConfig } from './primary-database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { config as redisCacheConfig } from './redis-cache.config';
import { CacheableMemory, Keyv } from 'cacheable';
import { createKeyv } from '@keyv/redis';
@Global()
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: primaryDatabaseConfig,
		}),
		CacheModule.registerAsync({
			isGlobal: true,
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory:
				async (configService: AppConfigService) => {
					const redisUrl = `redis://${configService.redis.host}:${configService.redis.port}`;
					return {
						stores: [
							new Keyv({
								store: new CacheableMemory(),
							}),
							createKeyv(redisUrl),
						],
					};
				},
		}),
	],
})
export class DatabaseModule {}
