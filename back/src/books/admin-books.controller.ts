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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Books Admin')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBooksController {
	constructor(private readonly booksService: BooksService) {}

	@Post()
	@ApiOperation({ summary: 'Create a new book', description: 'Create a new book with all its information (Admin only)' })
	@ApiResponse({ status: 201, description: 'Book created successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
	@ApiBearerAuth('JWT-auth')
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Patch(':idBook/fix')
	@ApiOperation({ summary: 'Fix book', description: 'Attempt to fix issues with a book (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Book fixed successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	fixBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/verify')
	@ApiOperation({ summary: 'Verify book', description: 'Verify book integrity and data (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Book verification completed' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	verifyBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.verifyBook(idBook);
	}

	@Patch(':idBook/reset')
	@ApiOperation({ summary: 'Reset book', description: 'Reset book data and cache (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Book reset successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	resetBook(
		@Param('idBook') idBook: string,
	) {
		return this.booksService.resetBook(idBook);
	}

	@Patch(':idBook')
	@ApiOperation({ summary: 'Update book', description: 'Update book information (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Book updated successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	updateBook(@Param('idBook') id: string, @Body() dto: UpdateBookDto) {
		return this.booksService.updateBook(id, dto);
	}

	@Patch(':idBook/chapters')
	@ApiOperation({ summary: 'Update chapters', description: 'Update multiple chapters at once (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Chapters updated successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	updateChapter(
		@Param('idBook') idBook: string,
		@Body() dto: UpdateChapterDto[],
	) {
		return this.booksService.updateChapter(idBook, dto);
	}

	@Patch(':idBook/chapters/order')
	@ApiOperation({ summary: 'Reorder chapters', description: 'Change the order of book chapters (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiResponse({ status: 200, description: 'Chapters reordered successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	orderChapters(
		@Param('idBook') idBook: string,
		@Body() dto: OrderChaptersDto[],
	) {
		return this.booksService.orderChapters(idBook, dto);
	}

	@Get('dashboard/overview')
	@ApiOperation({ summary: 'Get dashboard overview', description: 'Retrieve dashboard statistics and overview (Admin only)' })
	@ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
	@ApiBearerAuth('JWT-auth')
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(60 * 60) // 1h
	dashboard() {
		return this.booksService.getDashboardOverview();
	}

	@Get('dashboard/process-book')
	@ApiOperation({ summary: 'Get book processing status', description: 'Retrieve status of book processing jobs (Admin only)' })
	@ApiResponse({ status: 200, description: 'Processing status retrieved successfully' })
	@ApiBearerAuth('JWT-auth')
	processBookDashboard() {
		return this.booksService.getProcessBook();
	}

	@Patch(':idBook/covers/:idCover/selected')
	@ApiOperation({ summary: 'Select book cover', description: 'Set a specific cover as the main cover for a book (Admin only)' })
	@ApiParam({ name: 'idBook', description: 'Book unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
	@ApiParam({ name: 'idCover', description: 'Cover unique identifier', example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' })
	@ApiResponse({ status: 200, description: 'Cover selected successfully' })
	@ApiResponse({ status: 404, description: 'Book or cover not found' })
	@ApiBearerAuth('JWT-auth')
	selectCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.selectCover(idBook, idCover);
	}
}
