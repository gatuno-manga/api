import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './app-config/app-config.module';
import { ScrapingModule } from './scraping/scraping.module';
import { BooksModule } from './books/books.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { FilesModule } from './files/files.module';

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
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
