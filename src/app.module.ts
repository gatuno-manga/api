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
import { Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookRequestsModule } from './book-requests/book-requests.module';
import { BooksModule } from './books/books.module';
import { CollectionsModule } from './collections/collections.module';
import { CommonModule } from './common/common.module';
import { SystemEvents } from './common/domain/constants/events.constant';
import { AdaptiveThrottlerGuard } from './common/guards/adaptive-throttler.guard';
import { EtagInterceptor } from './common/interceptors/etag.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { DashboardModule } from './dashboard/dashboard.module';
import { FilesModule } from './files/files.module';
import { AppConfigModule } from './infrastructure/app-config/app-config.module';
import { AppConfigService } from './infrastructure/app-config/app-config.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { MeilisearchModule } from './infrastructure/meilisearch/meilisearch.module';
import { MqttModule } from './infrastructure/mqtt/mqtt.module';
import { InteractionsModule } from './interactions/interactions.module';
import { MetricsModule } from './metrics/metrics.module';
import { SyncModule } from './sync/sync.module';
import { RbacModule } from './users/rbac.module';
import { UsersModule } from './users/users.module';
import { WebsitesModule } from './websites/websites.module';

@Module({
	imports: [
		AppConfigModule,
		CommonModule,
		DashboardModule,
		LoggingModule,
		HealthModule,
		MetricsModule,
		DatabaseModule,
		MeilisearchModule,
		MqttModule,
		EventEmitterModule.forRoot(),
		ScheduleModule.forRoot(),
		RbacModule,
		AuthModule,
		UsersModule,
		CollectionsModule,
		InteractionsModule,

		GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			imports: [AppConfigModule],
			inject: [AppConfigService],
			useFactory: (configService: AppConfigService) => ({
				autoSchemaFile:
					configService.nodeEnv === 'production'
						? true
						: join(process.cwd(), 'src/schema.gql'),
				sortSchema: true,
				playground: configService.nodeEnv !== 'production',
				useGlobalPrefix: true,
				context: ({ req, res }: { req: Request; res: Response }) => ({
					req,
					res,
				}),
			}),
		}),
		ThrottlerModule.forRoot([
			{
				name: 'short',
				ttl: 1000,
				limit: 3,
			},
			{
				name: 'medium',
				ttl: 10000,
				limit: 20,
			},
			{
				name: 'long',
				ttl: 60000,
				limit: 100,
			},
		]),
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
		WebsitesModule,
		BooksModule,
		BookRequestsModule,
		SyncModule,
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
			useClass: AdaptiveThrottlerGuard,
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
		this.eventEmitter.emit(SystemEvents.APP_READY);
	}
}
