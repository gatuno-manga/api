import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { ScrapingModule } from 'src/scraping/scraping.module';
import { Page } from './entitys/page.entity';
import { Book } from './entitys/book.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chapter } from './entitys/chapter.entity';
import { BookScrapingEvents } from './events/book.scraping.events';
import { Tag } from './entitys/tags.entity';
import { Author } from './entitys/author.entity';
import { AppConfigModule } from 'src/app-config/app-config.module';
import { BookInitEvents } from './events/book.init.events';

@Module({
	imports: [
		ScrapingModule,
		AppConfigModule,
		TypeOrmModule.forFeature([Book, Page, Chapter, Tag, Author]),
	],
	controllers: [BooksController],
	providers: [BooksService, BookScrapingEvents, BookInitEvents],
})
export class BooksModule {}
