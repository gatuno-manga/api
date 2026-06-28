import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { CreateChapterBatchItemDto } from '@books/application/dto/create-chapter-batch-item.dto';
import { CreateChapterManualDto } from '@books/application/dto/create-chapter-manual.dto';
import { OrderChaptersDto } from '@books/application/dto/order-chapters.dto';
import { OrderCoversDto } from '@books/application/dto/order-covers.dto';
import { ScrapeCoverDto } from '@books/application/dto/scrape-cover.dto';
import { ToggleAutoUpdateDto } from '@books/application/dto/toggle-auto-update.dto';
import { UpdateBookDto } from '@books/application/dto/update-book.dto';
import { UpdateChapterDto } from '@books/application/dto/update-chapter.dto';
import { UpdateCoverDto } from '@books/application/dto/update-cover.dto';
import { UploadCoverDto } from '@books/application/dto/upload-cover.dto';
import { BookDeletionService } from '@books/application/services/book-deletion.service';
import { BookUploadService } from '@books/application/services/book-upload.service';
import { BooksService } from '@books/application/services/books.service';
import { ChapterManagementService } from '@books/application/services/chapter-management.service';
import { BookUpdateScheduler } from '@books/infrastructure/jobs/book-update.scheduler';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseArrayPipe,
	Patch,
	Post,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminApi } from 'src/common/swagger/auth-api.decorators';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsCheckAllBooksUpdates,
	ApiDocsCheckBookUpdates,
	ApiDocsCreateBook,
	ApiDocsCreateChaptersInBatch,
	ApiDocsCreateManualChapter,
	ApiDocsCreateManualChapterWithContent,
	ApiDocsDeleteBook,
	ApiDocsDeleteBooksInBatch,
	ApiDocsDeleteChapter,
	ApiDocsDeleteChaptersInBatch,
	ApiDocsDeleteCover,
	ApiDocsDeleteCoversInBatch,
	ApiDocsDeletePages,
	ApiDocsFixBook,
	ApiDocsFixBookCovers,
	ApiDocsFixCover,
	ApiDocsListDeletedBooks,
	ApiDocsListDeletedChapters,
	ApiDocsListDeletedCovers,
	ApiDocsListDeletedPages,
	ApiDocsOrderChapters,
	ApiDocsOrderCovers,
	ApiDocsResendUpdateEvent,
	ApiDocsResetBook,
	ApiDocsScrapeCover,
	ApiDocsSelectCover,
	ApiDocsToggleAutoUpdate,
	ApiDocsUpdateBook,
	ApiDocsUpdateChaptersBatch,
	ApiDocsUpdateCover,
	ApiDocsUploadCoverManual,
	ApiDocsVerifyBook,
} from './swagger/admin-books.swagger';

const IMAGE_FILE_FILTER = (
	_req: unknown,
	file: Express.Multer.File,
	callback: (error: Error | null, acceptFile: boolean) => void,
) => {
	if (!file.mimetype.match(/^image\//)) {
		return callback(
			new BadRequestException('Only image files are allowed'),
			false,
		);
	}
	callback(null, true);
};

@ApiTags('Books Admin')
@Controller('books')
@AdminApi()
export class AdminBooksController {
	constructor(
		private readonly booksService: BooksService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly bookUploadService: BookUploadService,
		private readonly bookDeletionService: BookDeletionService,
		private readonly bookUpdateScheduler: BookUpdateScheduler,
	) {}

	@Post()
	@Permissions(PermissionsEnum.BOOKS_CREATE)
	@Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 req/min
	@ApiDocsCreateBook()
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Post('auto-create')
	@Permissions(PermissionsEnum.SCRAPER_MANUAL)
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	async autoCreateBook(@Body('url') url: string) {
		if (!url) {
			throw new BadRequestException('URL is required');
		}
		return this.booksService.autoCreateBook(url);
	}

	@Patch(':idBook/fix')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsFixBook()
	fixBook(@Param('idBook') idBook: string) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/verify')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsVerifyBook()
	verifyBook(@Param('idBook') idBook: string) {
		return this.booksService.verifyBook(idBook);
	}

	@Patch(':idBook/reset')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsResetBook()
	resetBook(@Param('idBook') idBook: string) {
		return this.booksService.resetBook(idBook);
	}

	@Post(':idBook/check-updates')
	@Permissions(PermissionsEnum.SCRAPER_MANUAL)
	@ApiDocsCheckBookUpdates()
	async checkBookUpdates(@Param('idBook') idBook: string) {
		await this.bookUpdateScheduler.forceUpdateBook(idBook);
		return { message: 'Update check scheduled', bookId: idBook };
	}

	@Post('check-all-updates')
	@Permissions(PermissionsEnum.SCRAPER_AUTO)
	@ApiDocsCheckAllBooksUpdates()
	async checkAllBooksUpdates() {
		await this.bookUpdateScheduler.forceUpdateAllBooks();
		return { message: 'Update check scheduled for all books' };
	}

	@Patch(':idBook/auto-update')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@ApiDocsToggleAutoUpdate()
	async toggleAutoUpdate(
		@Param('idBook') idBook: string,
		@Body() dto: ToggleAutoUpdateDto,
	) {
		return this.booksService.toggleAutoUpdate(idBook, dto.enabled);
	}

	@Patch(':idBook/chapters')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@ApiDocsUpdateChaptersBatch()
	updateChapter(
		@Param('idBook') idBook: string,
		@Body() dto: UpdateChapterDto[],
	) {
		return this.booksService.updateChapter(idBook, dto);
	}

	@Patch(':idBook/chapters/order')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@ApiDocsOrderChapters()
	orderChapters(
		@Param('idBook') idBook: string,
		@Body() dto: OrderChaptersDto[],
	) {
		return this.booksService.orderChapters(idBook, dto);
	}

	@Patch(':idBook')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@ApiDocsUpdateBook()
	updateBook(@Param('idBook') id: string, @Body() dto: UpdateBookDto) {
		return this.booksService.updateBook(id, dto);
	}

	@Patch(':idBook/covers/:idCover/selected')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@ApiDocsSelectCover()
	selectCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.selectCover(idBook, idCover);
	}

	@Patch(':idBook/covers/order')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@ApiDocsOrderCovers()
	orderCovers(
		@Param('idBook') idBook: string,
		@Body() dto: OrderCoversDto[],
	) {
		return this.booksService.orderCovers(idBook, dto);
	}

	@Patch(':idBook/covers/:idCover/fix')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsFixCover()
	fixCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.fixCover(idBook, idCover);
	}

	@Patch(':idBook/covers/fix')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsFixBookCovers()
	fixBookCovers(@Param('idBook') idBook: string) {
		return this.booksService.fixBookCovers(idBook);
	}

	@Patch(':idBook/covers/:idCover')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@ApiDocsUpdateCover()
	updateCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
		@Body() dto: UpdateCoverDto,
	) {
		return this.booksService.updateCover(idBook, idCover, dto);
	}

	@Post(':idBook/covers/manual')
	@Permissions(PermissionsEnum.BOOKS_UPLOAD)
	@UseInterceptors(
		FileInterceptor('file', {
			limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
			fileFilter: IMAGE_FILE_FILTER,
		}),
	)
	@ApiDocsUploadCoverManual()
	async uploadCoverManual(
		@Param('idBook') idBook: string,
		@UploadedFile() file: Express.Multer.File,
		@Body() dto: UploadCoverDto,
	) {
		if (!file) {
			throw new BadRequestException('No file uploaded');
		}
		return this.booksService.manualUploadCover(idBook, file, dto);
	}

	@Post(':idBook/covers/scrape')
	@Permissions(PermissionsEnum.SCRAPER_MANUAL)
	@ApiDocsScrapeCover()
	async scrapeCover(
		@Param('idBook') idBook: string,
		@Body() dto: ScrapeCoverDto,
	) {
		return this.booksService.scrapeCover(idBook, dto);
	}

	@Post(':idBook/chapters/manual')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@ApiDocsCreateManualChapter()
	createManualChapter(
		@Param('idBook') idBook: string,
		@Body() dto: CreateChapterManualDto,
	) {
		return this.chapterManagementService.createManualChapter(idBook, dto);
	}

	@Post(':idBook/chapters/manual-with-content')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 req/min
	@ApiDocsCreateManualChapterWithContent()
	createManualChapterWithContent(
		@Param('idBook') idBook: string,
		@Body() dto: CreateChapterManualDto,
	) {
		return this.chapterManagementService.createManualChapterWithContent(
			idBook,
			dto,
		);
	}

	@Post(':idBook/batch/chapters')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsCreateChaptersInBatch()
	createChaptersInBatch(
		@Param('idBook') idBook: string,
		@Body(
			new ParseArrayPipe({
				items: CreateChapterBatchItemDto,
				whitelist: true,
				forbidNonWhitelisted: true,
			}),
		)
		dto: CreateChapterBatchItemDto[],
	) {
		return this.chapterManagementService.createChaptersBatch(idBook, dto);
	}

	// ==================== DELETION ENDPOINTS ====================

	@Post(':idBook/events/resend')
	@Permissions(PermissionsEnum.BOOKS_MAINTENANCE)
	@ApiDocsResendUpdateEvent()
	async resendUpdateEvent(@Param('idBook') idBook: string) {
		await this.booksService.resendBookUpdatedEvent(idBook);
		return { message: 'Book updated event resent successfully' };
	}

	@Delete(':idBook')
	@Permissions(PermissionsEnum.BOOKS_DELETE)
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteBook()
	deleteBook(@Param('idBook') idBook: string) {
		return this.bookDeletionService.deleteBook(idBook);
	}

	@Delete('batch/books')
	@Permissions(PermissionsEnum.BOOKS_DELETE)
	@Throttle({ short: { limit: 2, ttl: 60000 } }) // 2 req/min
	@ApiDocsDeleteBooksInBatch()
	deleteBooksInBatch(@Body('bookIds') bookIds: string[]) {
		return this.bookDeletionService.deleteBooks(bookIds);
	}

	@Delete('chapters/:idChapter')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiDocsDeleteChapter()
	deleteChapter(@Param('idChapter') idChapter: string) {
		return this.bookDeletionService.deleteChapter(idChapter);
	}

	@Delete('batch/chapters')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteChaptersInBatch()
	deleteChaptersInBatch(@Body('chapterIds') chapterIds: string[]) {
		return this.bookDeletionService.deleteChapters(chapterIds);
	}

	@Delete(':idBook/covers/:idCover')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
	@ApiDocsDeleteCover()
	deleteCover(
		@Param('idBook') _idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.bookDeletionService.deleteCover(idCover);
	}

	@Delete('batch/covers')
	@Permissions(PermissionsEnum.BOOKS_EDIT)
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteCoversInBatch()
	deleteCoversInBatch(@Body('coverIds') coverIds: string[]) {
		return this.bookDeletionService.deleteCovers(coverIds);
	}

	@Delete('chapters/:idChapter/pages')
	@Permissions(PermissionsEnum.CHAPTERS_MANAGE)
	@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
	@ApiDocsDeletePages()
	deletePages(
		@Param('idChapter') idChapter: string,
		@Body('pageIndices') pageIndices: number[],
	) {
		return this.bookDeletionService.deletePages(idChapter, pageIndices);
	}

	// ==================== LIST DELETED ITEMS ====================

	@Get('deleted/books')
	@Permissions(PermissionsEnum.BOOKS_VIEW_INTERNAL)
	@ApiDocsListDeletedBooks()
	listDeletedBooks() {
		return this.bookDeletionService.listDeletedBooks();
	}

	@Get('deleted/chapters')
	@Permissions(PermissionsEnum.CHAPTERS_VIEW_INTERNAL)
	@ApiDocsListDeletedChapters()
	listDeletedChapters() {
		return this.bookDeletionService.listDeletedChapters();
	}

	@Get('deleted/covers')
	@Permissions(PermissionsEnum.BOOKS_VIEW_INTERNAL)
	@ApiDocsListDeletedCovers()
	listDeletedCovers() {
		return this.bookDeletionService.listDeletedCovers();
	}

	@Get('deleted/pages')
	@Permissions(PermissionsEnum.CHAPTERS_VIEW_INTERNAL)
	@ApiDocsListDeletedPages()
	listDeletedPages() {
		return this.bookDeletionService.listDeletedPages();
	}
}
