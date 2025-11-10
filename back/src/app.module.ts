import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EventEmitter2, EventEmitterModule, EventEmitterReadinessWatcher } from '@nestjs/event-emitter';
import { AppConfigModule } from './app-config/app-config.module';
import { ScrapingModule } from './scraping/scraping.module';
import { BooksModule } from './books/books.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FilesModule } from './files/files.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { LoggingModule } from './logging/logging.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from './common/common.module';

@Module({
	imports: [
		CommonModule,
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
				ttl: 1000,     // 1 segundo
				limit: 3,
			},
			{
				name: 'medium',
				ttl: 10000,    // 10 segundos
				limit: 20,
			},
			{
				name: 'long',
				ttl: 60000,    // 1 minuto
				limit: 100,
			},
		]),
		ScrapingModule,
		BooksModule,
		ServeStaticModule.forRoot({
			rootPath: join(__dirname, '..', 'data'),
		}),
		BullModule.forRoot({
			defaultJobOptions: {
				attempts: 3,
				removeOnComplete: true,
				removeOnFail: 10,
				backoff: {
					type: 'exponential',
					delay: 5000,
				}
			},
			connection: {
				host: 'redis',
				port: 6379,
			},
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
