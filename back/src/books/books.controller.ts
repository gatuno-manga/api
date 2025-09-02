import {
	Body,
	Controller,
	Get,
	Logger,
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
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('books')
export class BooksController {
	constructor(private readonly booksService: BooksService) {}

	@Get()
	@UseGuards(OptionalAuthGuard)
	getAllBooks(
		@Query() pageOptions: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getAllBooks(pageOptions, user?.maxWeightSensitiveContent);
	}

	@Get(':idBook')
	@UseGuards(OptionalAuthGuard)
	getBook(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getOne(id, user?.userId, user?.maxWeightSensitiveContent);
	}
}
