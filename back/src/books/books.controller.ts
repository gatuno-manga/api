import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';

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

	@Get('tags')
	getTags() {
		return this.booksService.getTags();
	}

	@Get('sensitive-content')
	getSensitiveContent() {
		return this.booksService.getSensitiveContent();
	}

	@Patch('sensitive-content/:contentId/merge')
	updateSensitiveContent(
		@Param('contentId') contentId: string,
		@Body() dto: string[],
	) {
		return this.booksService.mergeSensitiveContent(contentId, dto);
	}


	@Get(':idBook')
	@UseGuards(OptionalAuthGuard)
	getBook(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getOne(id, user?.userId);
	}

	@Patch(':idBook/fix')
	fixBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.fixBook(idBook);
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
