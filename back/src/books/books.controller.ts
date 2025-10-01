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
import { BookPageOptionsDto } from './dto/book-page-options.dto';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';

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

	@Get('random')
	@UseGuards(OptionalAuthGuard)
	getRandomBook(
		@Query() options: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getRandomBook(options, user?.maxWeightSensitiveContent);
	}

	@Get(':idBook')
	@UseGuards(OptionalAuthGuard)
	getBook(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getOne(id, user?.maxWeightSensitiveContent);
	}

	@Get(':idBook/chapters')
	@UseGuards(OptionalAuthGuard)
	getBookChapters(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getChapters(id, user?.userId, user?.maxWeightSensitiveContent);
	}

	@Get(':idBook/covers')
	@UseGuards(OptionalAuthGuard)
	getBookCovers(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getCovers(id, user?.maxWeightSensitiveContent);
	}

	@Get(':idBook/infos')
	@UseGuards(OptionalAuthGuard)
	getBookInfos(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto
	) {
		return this.booksService.getInfos(id, user?.maxWeightSensitiveContent);
	}
}
