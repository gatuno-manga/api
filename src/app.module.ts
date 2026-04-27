import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { BullModule } from '@nestjs/bullmq';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import {
	EventEmitter2,
	EventEmitterModule,
	EventEmitterReadinessWatcher,
} from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { AppConfigModule } from './infrastructure/app-config/app-config.module';
import { AppConfigService } from './infrastructure/app-config/app-config.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookRequestsModule } from './book-requests/book-requests.module';
import { BooksModule } from './books/books.module';
import { CommonModule } from './common/common.module';
import { EtagInterceptor } from './common/interceptors/etag.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { FilesModule } from './files/files.module';
import { HealthModule } from './infrastructure/health/health.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { MetricsModule } from './metrics/metrics.module';
import { ScrapingModule } from './scraping/scraping.module';
import { SyncModule } from './sync/sync.module';
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
		GraphQLModule.forRoot<ApolloDriverConfig>({
			driver: ApolloDriver,
			autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
			sortSchema: true,
			playground: true,
			useGlobalPrefix: true,
			context: ({ req, res }) => ({ req, res }),
		}),
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000, // 1 segundo
				limit: 100, // Aumentado de 3 para 100
			},
			{
				name: 'medium',
				ttl: 10000, // 10 segundos
				limit: 200, // Aumentado de 20 para 200
			},
			{
				name: 'long',
				ttl: 60000, // 1 minuto
				limit: 1000, // Aumentado de 100 para 1000
			},
		]),
		ScrapingModule,
		BooksModule,
		SyncModule,
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
		BookRequestsModule,
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
			provide: APP_INTERCEPTOR,
			useClass: EtagInterceptor,
		},
		{
			provide: APP_GUARD,
			useClass: GqlThrottlerGuard,
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
