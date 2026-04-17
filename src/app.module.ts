import { BullModule } from '@nestjs/bullmq';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
	EventEmitter2,
	EventEmitterModule,
	EventEmitterReadinessWatcher,
} from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './app-config/app-config.module';
import { AppConfigService } from './app-config/app-config.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CommonModule } from './common/common.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { MetricsModule } from './metrics/metrics.module';
import { ScrapingModule } from './scraping/scraping.module';
import { UsersModule } from './users/users.module';

@Module({
	imports: [
		CommonModule,
		DashboardModule,
		LoggingModule,
		HealthModule,
		MetricsModule,
		DatabaseModule,
		AppConfigModule,
		EventEmitterModule.forRoot(),
		ScheduleModule.forRoot(),
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000, // 1 segundo
				limit: 3,
			},
			{
				name: 'medium',
				ttl: 10000, // 10 segundos
				limit: 20,
			},
			{
				name: 'long',
				ttl: 60000, // 1 minuto
				limit: 100,
			},
		]),
		ScrapingModule,
		BooksModule,
		BullModule.forRootAsync({
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: (configService: AppConfigService) => ({
				defaultJobOptions: {
					attempts: 3,
					removeOnComplete: true,
					removeOnFail: 10,
					backoff: {
						type: 'exponential',
						delay: 5000,
					},
				},
				connection: {
					host: configService.redis.host,
					port: configService.redis.port,
					password: configService.redis.password || undefined,
					connectTimeout: 10000,
					commandTimeout: 30000,
					keepAlive: 30000,
					maxRetriesPerRequest: null,
					retryStrategy: (times: number) => {
						if (times > 10) return null;
						return Math.min(times * 50, 2000);
					},
					enableReadyCheck: true,
					enableOfflineQueue: true,
				},
			}),
		}),
		FilesModule,
		UsersModule,
		AuthModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_INTERCEPTOR,
			useClass: LoggingInterceptor,
		},
		{
			provide: APP_INTERCEPTOR,
			useClass: MetricsInterceptor,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
	],
})
export class AppModule implements OnApplicationBootstrap {
	constructor(
		private readonly eventEmitterReadinessWatcher: EventEmitterReadinessWatcher,
		private eventEmitter: EventEmitter2,
	) {}

	async onApplicationBootstrap() {
		await this.eventEmitterReadinessWatcher.waitUntilReady();
		this.eventEmitter.emit('app.ready');
	}
}
