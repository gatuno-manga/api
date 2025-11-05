import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
    imports: [TerminusModule, HttpModule, AppConfigModule],
    controllers: [HealthController],
})
export class HealthModule {}
