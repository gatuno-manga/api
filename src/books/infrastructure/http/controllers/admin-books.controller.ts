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
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { BooksService } from '@books/application/services/books.service';
import { CreateBookDto } from '@books/application/dto/create-book.dto';
import { CreateChapterBatchItemDto } from '@books/application/dto/create-chapter-batch-item.dto';
import { CreateChapterManualDto } from '@books/application/dto/create-chapter-manual.dto';
import { OrderChaptersDto } from '@books/application/dto/order-chapters.dto';
import { OrderCoversDto } from '@books/application/dto/order-covers.dto';
import { ToggleAutoUpdateDto } from '@books/application/dto/toggle-auto-update.dto';
import { UpdateBookDto } from '@books/application/dto/update-book.dto';
import { UpdateChapterDto } from '@books/application/dto/update-chapter.dto';
import { UpdateCoverDto } from '@books/application/dto/update-cover.dto';
import { UploadCoverDto } from '@books/application/dto/upload-cover.dto';
import { ScrapeCoverDto } from '@books/application/dto/scrape-cover.dto';
import { BookUpdateScheduler } from '@books/infrastructure/jobs/book-update.scheduler';
import { BookDeletionService } from '@books/application/services/book-deletion.service';
import { ChapterManagementService } from '@books/application/services/chapter-management.service';
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
	ApiDocsScrapeCover,
	ApiDocsSelectCover,
	ApiDocsToggleAutoUpdate,
	ApiDocsUpdateBook,
	ApiDocsUpdateChaptersBatch,
	ApiDocsUpdateCover,
	ApiDocsUploadCoverManual,
	ApiDocsVerifyBook,
	ApiDocsResetBook,
} from './swagger/admin-books.swagger';

@ApiTags('Books Admin')
@Controller('books')
@UseGuards(JwtAuthGuard)
@Roles(RolesEnum.ADMIN)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class AdminBooksController {
	constructor(
		private readonly booksService: BooksService,
		private readonly chapterManagementService: ChapterManagementService,
		private readonly bookDeletionService: BookDeletionService,
		private readonly bookUpdateScheduler: BookUpdateScheduler,
	) {}

	@Post()
	@Throttle({ medium: { limit: 30, ttl: 60000 } }) // 30 req/min
	@ApiDocsCreateBook()
	createBook(@Body() dto: CreateBookDto) {
		return this.booksService.createBook(dto);
	}

	@Patch(':idBook/fix')
	@ApiDocsFixBook()
	fixBook(@Param('idBook') idBook: string) {
		return this.booksService.fixBook(idBook);
	}

	@Get(':idBook/verify')
	@ApiDocsVerifyBook()
	verifyBook(@Param('idBook') idBook: string) {
		return this.booksService.verifyBook(idBook);
	}

	@Patch(':idBook/reset')
	@ApiDocsResetBook()
	resetBook(@Param('idBook') idBook: string) {
		return this.booksService.resetBook(idBook);
	}

	@Post(':idBook/check-updates')
	@ApiDocsCheckBookUpdates()
	async checkBookUpdates(@Param('idBook') idBook: string) {
		await this.bookUpdateScheduler.forceUpdateBook(idBook);
		return { message: 'Update check scheduled', bookId: idBook };
	}

	@Post('check-all-updates')
	@ApiDocsCheckAllBooksUpdates()
	async checkAllBooksUpdates() {
		await this.bookUpdateScheduler.forceUpdateAllBooks();
		return { message: 'Update check scheduled for all books' };
	}

	@Patch(':idBook/auto-update')
	@ApiDocsToggleAutoUpdate()
	async toggleAutoUpdate(
		@Param('idBook') idBook: string,
		@Body() dto: ToggleAutoUpdateDto,
	) {
		return this.booksService.toggleAutoUpdate(idBook, dto.enabled);
	}

	@Patch(':idBook/chapters')
	@ApiDocsUpdateChaptersBatch()
	updateChapter(
		@Param('idBook') idBook: string,
		@Body() dto: UpdateChapterDto[],
	) {
		return this.booksService.updateChapter(idBook, dto);
	}

	@Patch(':idBook/chapters/order')
	@ApiDocsOrderChapters()
	orderChapters(
		@Param('idBook') idBook: string,
		@Body() dto: OrderChaptersDto[],
	) {
		return this.booksService.orderChapters(idBook, dto);
	}

	@Patch(':idBook')
	@ApiDocsUpdateBook()
	updateBook(@Param('idBook') id: string, @Body() dto: UpdateBookDto) {
		return this.booksService.updateBook(id, dto);
	}

	@Patch(':idBook/covers/:idCover/selected')
	@ApiDocsSelectCover()
	selectCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.selectCover(idBook, idCover);
	}

	@Patch(':idBook/covers/order')
	@ApiDocsOrderCovers()
	orderCovers(
		@Param('idBook') idBook: string,
		@Body() dto: OrderCoversDto[],
	) {
		return this.booksService.orderCovers(idBook, dto);
	}

	@Patch(':idBook/covers/:idCover/fix')
	@ApiDocsFixCover()
	fixCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.booksService.fixCover(idBook, idCover);
	}

	@Patch(':idBook/covers/fix')
	@ApiDocsFixBookCovers()
	fixBookCovers(@Param('idBook') idBook: string) {
		return this.booksService.fixBookCovers(idBook);
	}

	@Patch(':idBook/covers/:idCover')
	@ApiDocsUpdateCover()
	updateCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
		@Body() dto: UpdateCoverDto,
	) {
		return this.booksService.updateCover(idBook, idCover, dto);
	}

	@Post(':idBook/covers/manual')
	@UseInterceptors(FileInterceptor('file'))
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
	@ApiDocsScrapeCover()
	async scrapeCover(
		@Param('idBook') idBook: string,
		@Body() dto: ScrapeCoverDto,
	) {
		return this.booksService.scrapeCover(idBook, dto);
	}

	@Post(':idBook/chapters/manual')
	@ApiDocsCreateManualChapter()
	createManualChapter(
		@Param('idBook') idBook: string,
		@Body() dto: CreateChapterManualDto,
	) {
		return this.chapterManagementService.createManualChapter(idBook, dto);
	}

	@Post(':idBook/chapters/manual-with-content')
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

	@Post('batch/chapters')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsCreateChaptersInBatch()
	createChaptersInBatch(
		@Body(
			new ParseArrayPipe({
				items: CreateChapterBatchItemDto,
				whitelist: true,
				forbidNonWhitelisted: true,
			}),
		)
		dto: CreateChapterBatchItemDto[],
	) {
		if (dto.length > 100) {
			throw new BadRequestException(
				'Limite máximo por lote é 100 capítulos',
			);
		}

		return this.chapterManagementService.createManualChaptersInBatch(dto);
	}

	// ==================== DELETION ENDPOINTS ====================

	@Delete(':idBook')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteBook()
	deleteBook(@Param('idBook') idBook: string) {
		return this.bookDeletionService.deleteBook(idBook);
	}

	@Delete('batch/books')
	@Throttle({ short: { limit: 2, ttl: 60000 } }) // 2 req/min
	@ApiDocsDeleteBooksInBatch()
	deleteBooksInBatch(@Body('bookIds') bookIds: string[]) {
		return this.bookDeletionService.deleteBooks(bookIds);
	}

	@Delete('chapters/:idChapter')
	@Throttle({ short: { limit: 10, ttl: 60000 } }) // 10 req/min
	@ApiDocsDeleteChapter()
	deleteChapter(@Param('idChapter') idChapter: string) {
		return this.bookDeletionService.deleteChapter(idChapter);
	}

	@Delete('batch/chapters')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteChaptersInBatch()
	deleteChaptersInBatch(@Body('chapterIds') chapterIds: string[]) {
		return this.bookDeletionService.deleteChapters(chapterIds);
	}

	@Delete(':idBook/covers/:idCover')
	@Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
	@ApiDocsDeleteCover()
	deleteCover(
		@Param('idBook') idBook: string,
		@Param('idCover') idCover: string,
	) {
		return this.bookDeletionService.deleteCover(idCover);
	}

	@Delete('batch/covers')
	@Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 req/min
	@ApiDocsDeleteCoversInBatch()
	deleteCoversInBatch(@Body('coverIds') coverIds: string[]) {
		return this.bookDeletionService.deleteCovers(coverIds);
	}

	@Delete('chapters/:idChapter/pages')
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
	@ApiDocsListDeletedBooks()
	listDeletedBooks() {
		return this.bookDeletionService.listDeletedBooks();
	}

	@Get('deleted/chapters')
	@ApiDocsListDeletedChapters()
	listDeletedChapters() {
		return this.bookDeletionService.listDeletedChapters();
	}

	@Get('deleted/covers')
	@ApiDocsListDeletedCovers()
	listDeletedCovers() {
		return this.bookDeletionService.listDeletedCovers();
	}

	@Get('deleted/pages')
	@ApiDocsListDeletedPages()
	listDeletedPages() {
		return this.bookDeletionService.listDeletedPages();
	}
}
