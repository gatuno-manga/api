import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';

@Controller('books')
export class BooksController {
	constructor(private readonly booksService: BooksService) {}
	@Get() getAllBooks(@Query() pageOptions: BookPageOptionsDto) {
		return this.booksService.getAllBooks(pageOptions);
	}
	@Post()
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Get(':idBook')
	getBook(@Param('idBook') id: string) {
		return this.booksService.getOne(id);
	}

	@Get(':idBook/chapters/:idChapter')
	getChapter(
		@Param('idBook') idBook: string,
		@Param('idChapter') idChapter: string,
	) {
		return this.booksService.getChapter(idBook, idChapter);
	}
}
