import { Module, OnApplicationBootstrap } from '@nestjs/common';
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
import { AppConfigService } from './app-config/app-config.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigService } from '@nestjs/config';

@Module({
	imports: [
		DatabaseModule,
		AppConfigModule,
		EventEmitterModule.forRoot(),
		ScrapingModule,
		BooksModule,
		ServeStaticModule.forRoot({
			rootPath: join(__dirname, '..', 'data'),
		}),
		FilesModule,
		UsersModule,
		AuthModule,
		// CacheModule.register({
		// 	store: redisStore,
		// 	isGlobal: true,
		// 	host: 'localhost',
		// 	port: 6379,
		// })
		// CacheModule.registerAsync({
		// 	isGlobal: true, // Torna o CacheModule disponível globalmente
		// 	imports: [AppConfigModule],
		// 	inject: [AppConfigModule],
		// 	useFactory: async (configService: AppConfigService) => {
		// 		const store = await redisStore({
		// 			socket: {
		// 				host: configService.redis.host,
		// 				port: configService.redis.port,
		// 			},
		// 		});
		// 		return {
		// 			store: () => store,
		// 		};
		// 	},
		// }),
	],
	controllers: [AppController],
	providers: [AppService],
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
