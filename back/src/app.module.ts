import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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

@Module({
	imports: [
		LoggingModule,
		HealthModule,
		MetricsModule,
		DatabaseModule,
		AppConfigModule,
		EventEmitterModule.forRoot(),
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
