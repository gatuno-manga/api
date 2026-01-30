import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Delete,
	UseGuards,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBearerAuth,
	ApiBody,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { UpdateCoverDto } from './dto/update-cover.dto';
import { OrderChaptersDto } from './dto/order-chapters.dto';
import { OrderCoversDto } from './dto/order-covers.dto';
import { CreateChapterManualDto } from './dto/create-chapter-manual.dto';
import { ToggleAutoUpdateDto } from './dto/toggle-auto-update.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { ChapterManagementService } from './services/chapter-management.service';
import { BookDeletionService } from './services/book-deletion.service';
import { BookUpdateScheduler } from './jobs/book-update.scheduler';

@ApiTags('Books Admin')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminBooksController {
	constructor(
		private readonly booksService: BooksService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly bookDeletionService: BookDeletionService,
		private readonly bookUpdateScheduler: BookUpdateScheduler,
	) {}

	@Post()
	@Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 req/min
	@ApiOperation({
		summary: 'Create a new book',
		description: 'Create a new book with all its information (Admin only)',
	})
	@ApiResponse({ status: 201, description: 'Book created successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Patch(':idBook/fix')
	@ApiOperation({
		summary: 'Fix book',
		description: 'Attempt to fix issues with a book (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Book fixed successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	fixBook(@Param('idBook') idBook: string) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/verify')
	@ApiOperation({
		summary: 'Verify book',
		description: 'Verify book integrity and data (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Book verification completed' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	verifyBook(@Param('idBook') idBook: string) {
		return this.booksService.verifyBook(idBook);
	}

	@Patch(':idBook/reset')
	@ApiOperation({
		summary: 'Reset book',
		description: 'Reset book data and cache (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Book reset successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	resetBook(@Param('idBook') idBook: string) {
		return this.booksService.resetBook(idBook);
	}

	@Post(':idBook/check-updates')
	@ApiOperation({
		summary: 'Check for book updates',
		description:
			'Force check for new chapters on a specific book (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Update check scheduled' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	async checkBookUpdates(@Param('idBook') idBook: string) {
		await this.bookUpdateScheduler.forceUpdateBook(idBook);
		return { message: 'Update check scheduled', bookId: idBook };
	}

	@Post('check-all-updates')
	@ApiOperation({
		summary: 'Check updates for all books',
		description: 'Force check for new chapters on all books (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Update check scheduled for all books',
	})
	@ApiBearerAuth('JWT-auth')
	async checkAllBooksUpdates() {
		await this.bookUpdateScheduler.forceUpdateAllBooks();
		return { message: 'Update check scheduled for all books' };
	}

	@Patch(':idBook/auto-update')
	@ApiOperation({
		summary: 'Toggle automatic updates',
		description:
			'Enable or disable automatic update checks for a book (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		type: ToggleAutoUpdateDto,
		description: 'Auto-update toggle settings',
		examples: {
			enable: {
				summary: 'Enable auto-update',
				value: { enabled: true },
			},
			disable: {
				summary: 'Disable auto-update',
				value: { enabled: false },
			},
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Auto-update setting changed successfully',
		schema: {
			type: 'object',
			properties: {
				id: { type: 'string' },
				title: { type: 'string' },
				autoUpdate: { type: 'boolean' },
			},
		},
	})
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	async toggleAutoUpdate(
		@Param('idBook') idBook: string,
		@Body() dto: ToggleAutoUpdateDto,
	) {
		return this.booksService.toggleAutoUpdate(idBook, dto.enabled);
	}

	@Patch(':idBook')
	@ApiOperation({
		summary: 'Update book',
		description: 'Update book information (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Book updated successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	updateBook(@Param('idBook') id: string, @Body() dto: UpdateBookDto) {
		return this.booksService.updateBook(id, dto);
	}

	@Patch(':idBook/chapters')
	@ApiOperation({
		summary: 'Update chapters',
		description: 'Update multiple chapters at once (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
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
	@ApiOperation({
		summary: 'Reorder chapters',
		description: 'Change the order of book chapters (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Chapters reordered successfully',
	})
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	orderChapters(
		@Param('idBook') idBook: string,
		@Body() dto: OrderChaptersDto[],
	) {
		return this.booksService.orderChapters(idBook, dto);
	}

	@Patch(':idBook/covers/:idCover/selected')
	@ApiOperation({
		summary: 'Select book cover',
		description:
			'Set a specific cover as the main cover for a book (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idCover',
		description: 'Cover unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({ status: 200, description: 'Cover selected successfully' })
	@ApiResponse({ status: 404, description: 'Book or cover not found' })
	@ApiBearerAuth('JWT-auth')
	selectCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.selectCover(idBook, idCover);
	}

	@Patch(':idBook/covers/order')
	@ApiOperation({
		summary: 'Reorder book covers',
		description: 'Change the order of book covers (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Covers reordered successfully',
	})
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiBearerAuth('JWT-auth')
	orderCovers(
		@Param('idBook') idBook: string,
		@Body() dto: OrderCoversDto[],
	) {
		return this.booksService.orderCovers(idBook, dto);
	}

	@Patch(':idBook/covers/:idCover')
	@ApiOperation({
		summary: 'Update book cover',
		description: 'Update cover data for a book (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idCover',
		description: 'Cover unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({ status: 200, description: 'Cover updated successfully' })
	@ApiResponse({ status: 404, description: 'Book or cover not found' })
	@ApiBearerAuth('JWT-auth')
	updateCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
		@Body() dto: UpdateCoverDto,
	) {
		return this.booksService.updateCover(idBook, idCover, dto);
	}

	@Post(':idBook/chapters/manual')
	@ApiOperation({
		summary: 'Create manual chapter',
		description:
			'Create a chapter without URL for manual page upload (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 201, description: 'Chapter created successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiBearerAuth('JWT-auth')
	createManualChapter(
		@Param('idBook') idBook: string,
		@Body() dto: CreateChapterManualDto,
	) {
		return this.chapterManagementService.createManualChapter(idBook, dto);
	}

	// ==================== DELETION ENDPOINTS ====================

	@Delete(':idBook')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiOperation({
		summary: 'Delete book (soft delete)',
		description:
			'Soft delete a book and schedule its files for deletion after retention period (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Book deleted successfully' })
	@ApiResponse({ status: 404, description: 'Book not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteBook(@Param('idBook') idBook: string) {
		return this.bookDeletionService.deleteBook(idBook);
	}

	@Delete('batch/books')
	@Throttle({ short: { limit: 2, ttl: 60000 } }) // 2 req/min
	@ApiOperation({
		summary: 'Delete multiple books (batch)',
		description:
			'Soft delete multiple books at once (max 100) (Admin only)',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				bookIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of book IDs to delete',
					example: [
						'550e8400-e29b-41d4-a716-446655440000',
						'6ba7b810-9dad-11d1-80b4-00c04fd430c8',
					],
				},
			},
			required: ['bookIds'],
		},
	})
	@ApiResponse({ status: 200, description: 'Books deleted successfully' })
	@ApiResponse({
		status: 400,
		description: 'Invalid input or too many books',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteBooksInBatch(@Body('bookIds') bookIds: string[]) {
		return this.bookDeletionService.deleteBooks(bookIds);
	}

	@Delete('chapters/:idChapter')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiOperation({
		summary: 'Delete chapter (soft delete)',
		description:
			'Soft delete a chapter and schedule its pages for deletion (Admin only)',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Chapter deleted successfully' })
	@ApiResponse({ status: 404, description: 'Chapter not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteChapter(@Param('idChapter') idChapter: string) {
		return this.bookDeletionService.deleteChapter(idChapter);
	}

	@Delete('batch/chapters')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiOperation({
		summary: 'Delete multiple chapters (batch)',
		description:
			'Soft delete multiple chapters at once (max 100) (Admin only)',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				chapterIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of chapter IDs to delete',
					example: ['550e8400-e29b-41d4-a716-446655440000'],
				},
			},
			required: ['chapterIds'],
		},
	})
	@ApiResponse({ status: 200, description: 'Chapters deleted successfully' })
	@ApiResponse({
		status: 400,
		description: 'Invalid input or too many chapters',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteChaptersInBatch(@Body('chapterIds') chapterIds: string[]) {
		return this.bookDeletionService.deleteChapters(chapterIds);
	}

	@Delete(':idBook/covers/:idCover')
	@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
	@ApiOperation({
		summary: 'Delete book cover',
		description: 'Soft delete a specific cover image (Admin only)',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idCover',
		description: 'Cover unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({ status: 200, description: 'Cover deleted successfully' })
	@ApiResponse({ status: 404, description: 'Cover not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.bookDeletionService.deleteCover(idCover);
	}

	@Delete('batch/covers')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiOperation({
		summary: 'Delete multiple covers (batch)',
		description: 'Soft delete multiple covers at once (Admin only)',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				coverIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of cover IDs to delete',
					example: ['6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
				},
			},
			required: ['coverIds'],
		},
	})
	@ApiResponse({ status: 200, description: 'Covers deleted successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deleteCoversInBatch(@Body('coverIds') coverIds: string[]) {
		return this.bookDeletionService.deleteCovers(coverIds);
	}

	@Delete('chapters/:idChapter/pages')
	@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
	@ApiOperation({
		summary: 'Delete chapter pages',
		description: 'Soft delete specific pages from a chapter (Admin only)',
	})
	@ApiParam({
		name: 'idChapter',
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				pageIndices: {
					type: 'array',
					items: { type: 'number' },
					description: 'Array of page indices to delete',
					example: [1, 2, 3],
				},
			},
			required: ['pageIndices'],
		},
	})
	@ApiResponse({ status: 200, description: 'Pages deleted successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input' })
	@ApiResponse({ status: 404, description: 'Chapter or pages not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	deletePages(
		@Param('idChapter') idChapter: string,
		@Body('pageIndices') pageIndices: number[],
	) {
		return this.bookDeletionService.deletePages(idChapter, pageIndices);
	}

	// ==================== LIST DELETED ITEMS ====================

	@Get('deleted/books')
	@ApiOperation({
		summary: 'List deleted books',
		description:
			'Retrieve all soft-deleted books pending permanent deletion (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Deleted books retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	listDeletedBooks() {
		return this.bookDeletionService.listDeletedBooks();
	}

	@Get('deleted/chapters')
	@ApiOperation({
		summary: 'List deleted chapters',
		description:
			'Retrieve all soft-deleted chapters pending permanent deletion (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Deleted chapters retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	listDeletedChapters() {
		return this.bookDeletionService.listDeletedChapters();
	}

	@Get('deleted/covers')
	@ApiOperation({
		summary: 'List deleted covers',
		description:
			'Retrieve all soft-deleted covers pending permanent deletion (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Deleted covers retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	listDeletedCovers() {
		return this.bookDeletionService.listDeletedCovers();
	}

	@Get('deleted/pages')
	@ApiOperation({
		summary: 'List deleted pages',
		description:
			'Retrieve all soft-deleted pages pending permanent deletion (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'Deleted pages retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiBearerAuth('JWT-auth')
	listDeletedPages() {
		return this.bookDeletionService.listDeletedPages();
	}
}
