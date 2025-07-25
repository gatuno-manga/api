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
import { ChapterRead } from 'src/books/entitys/chapter-read.entity';
import { AuthModule } from 'src/auth/auth.module';
import { SensitiveContent } from './entitys/sensitive-content.entity';
import { ChapterController } from './chapters/chapter.controller';
import { ChapterService } from './chapters/chapter.service';
import { TagsController } from './tags/tags.controller';
import { SensitiveContentController } from './sensitive-content/sensitive-content.controller';
import { SensitiveContentService } from './sensitive-content/sensitive-content.service';
import { TagsService } from './tags/tags.service';

@Module({
	imports: [
		ScrapingModule,
		AppConfigModule,
		TypeOrmModule.forFeature([
			Book,
			Page,
			Chapter,
			Tag,
			Author,
			ChapterRead,
			SensitiveContent
		]),
		AuthModule,
	],
	controllers: [BooksController, ChapterController, SensitiveContentController, TagsController],
	providers: [BooksService, BookScrapingEvents, BookInitEvents, ChapterService, SensitiveContentService, TagsService],
})
export class BooksModule {}
