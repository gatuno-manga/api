import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBooksController {
	constructor(private readonly booksService: BooksService) {}

	@Post()
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Patch(':idBook/fix')
	fixBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/verify')
	verifyBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.verifyBook(idBook);
	}

	@Patch(':idBook/reset')
	resetBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.resetBook(idBook);
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

	@Get('dashboard/overview')
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(60 * 60) // 1h
	dashboard() {
		return this.booksService.getDashboardOverview();
	}

	@Get('dashboard/process-book')
	processBookDashboard() {
		return this.booksService.getProcessBook();
	}

	@Patch(':idBook/covers/:idCover/selected')
	selectCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.selectCover(idBook, idCover);
	}
}
