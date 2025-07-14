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
