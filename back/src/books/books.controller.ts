import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';

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

	@Patch(':idBook/fix')
	fixBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/chapters/:idChapter')
	getChapter(
		@Param('idBook') idBook: string,
		@Param('idChapter') idChapter: string,
	) {
		return this.booksService.getChapter(idBook, idChapter);
	}

	@Patch(':idBook/chapters/:idChapter/reset')
	resetChapter(
		@Param('idBook') idBook: string,
		@Param('idChapter') idChapter: string,
	) {
		return this.booksService.resetChapter(idBook, idChapter);
	}

	@Patch(':idBook')
	updateBook(@Param('idBook') id: string, @Body() dto: UpdateBookDto) {
		return this.booksService.updateBook(id, dto);
	}

	@Patch(':idBook/chapters')
	updateChapter(
		@Param('idBook') idBook: string,
		@Body() dto: UpdateChapterDto[],
	) {
		return this.booksService.updateChapter(idBook, dto);
	}

	@Patch(':idBook/chapters/order')
	orderChapters(
		@Param('idBook') idBook: string,
		@Body() dto: OrderChaptersDto[],
	) {
		return this.booksService.orderChapters(idBook, dto);
	}
}
