import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { AppConfigModule } from '../app-config/app-config.module';
import { RedisModule } from '../redis/redis.module';
import { HealthController } from './health.controller';

@Module({
	imports: [TerminusModule, HttpModule, AppConfigModule, RedisModule],
	controllers: [HealthController],
})
export class HealthModule {}
