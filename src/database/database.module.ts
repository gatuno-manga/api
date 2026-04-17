import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { AppConfigService } from 'src/app-config/app-config.service';
import { config as primaryDatabaseConfig } from './primary-database.config';
import { config as redisCacheConfig } from './redis-cache.config';
@Global()
@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: primaryDatabaseConfig,
		}),
		CacheModule.registerAsync(redisCacheConfig),
	],
})
export class DatabaseModule {}
