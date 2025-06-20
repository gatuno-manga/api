import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { BooksController } from './books.controller';
import { ScrapingModule } from 'src/scraping/scraping.module';
import { Page } from './entitys/page.entity';
import { Book } from './entitys/book.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chapter } from './entitys/chapter.entity';

@Module({
	imports: [ScrapingModule, TypeOrmModule.forFeature([Book, Page, Chapter])],
	controllers: [BooksController],
	providers: [BooksService],
})
export class BooksModule {}
