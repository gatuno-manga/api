import { BookChaptersCursorOptionsDto } from '@books/application/dto/book-chapters-cursor-options.dto';
import { BookChaptersCursorPageDto } from '@books/application/dto/book-chapters-cursor-page.dto';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { BookRelationshipsQueryDto } from '@books/application/dto/book-relationships-query.dto';
import { OfflineSyncQueryDto } from '@books/application/dto/offline-sync-query.dto';
import { BooksService } from '@books/application/services/books.service';
import { CacheTTL } from '@nestjs/cache-manager';
import {
	Controller,
	Get,
	Param,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsCheckBookTitle,
	ApiDocsGetAllBooks,
	ApiDocsGetBook,
	ApiDocsGetBookChapters,
	ApiDocsGetBookCovers,
	ApiDocsGetBookInfos,
	ApiDocsGetBookRelationships,
	ApiDocsGetOfflineSync,
	ApiDocsGetRandomBook,
} from './swagger/books.swagger';

@ApiTags('Books')
@Controller('books')
@UseGuards(PermissionsGuard)
export class BooksController {
	constructor(private readonly booksService: BooksService) {}

	@Get()
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(180)
	@ApiDocsGetAllBooks()
	@UseGuards(OptionalAuthGuard)
	getAllBooks(
		@Query() pageOptions: BookPageOptionsDto,
		@Query('lang') queryLang?: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		const targetLang = queryLang || user?.contentLanguages?.[0];
		return this.booksService.getAllBooks(
			pageOptions,
			user?.maxWeightSensitiveContent,
			user?.userId,
			targetLang,
		);
	}

	@Get('random')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(60)
	@ApiDocsGetRandomBook()
	@UseGuards(OptionalAuthGuard)
	getRandomBook(
		@Query() options: BookPageOptionsDto,
		@Query('lang') queryLang?: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		const targetLang = queryLang || user?.contentLanguages?.[0];
		return this.booksService.getRandomBook(
			options,
			user?.maxWeightSensitiveContent,
			user?.userId,
			targetLang,
		);
	}

	@Get('check-title/:title')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@ApiDocsCheckBookTitle()
	checkBookTitle(
		@Param('title') title: string,
		@Query('alternativeTitles') alternativeTitles?: string,
	) {
		const altTitlesArray = alternativeTitles
			? alternativeTitles
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t.length > 0)
			: undefined;
		return this.booksService.checkBookTitleConflict(title, altTitlesArray);
	}

	@Get(':idBook')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiDocsGetBook()
	@UseGuards(OptionalAuthGuard)
	getBook(
		@Param('idBook') id: string,
		@Query('lang') queryLang?: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		const targetLang = queryLang || user?.contentLanguages?.[0];
		return this.booksService.getOne(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
			false,
			targetLang,
		);
	}

	@Get(':idBook/chapters')
	@Permissions(PermissionsEnum.CHAPTERS_VIEW)
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiDocsGetBookChapters()
	@UseGuards(OptionalAuthGuard)
	getBookChapters(
		@Param('idBook') id: string,
		@Query() options: BookChaptersCursorOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	): Promise<BookChaptersCursorPageDto> {
		return this.booksService.getChapters(
			id,
			options,
			user?.userId,
			user?.maxWeightSensitiveContent,
		);
	}

	@Get(':idBook/offline-sync')
	@Permissions(PermissionsEnum.SYNC_ALL)
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(300)
	@ApiDocsGetOfflineSync()
	@UseGuards(OptionalAuthGuard)
	getOfflineSync(
		@Param('idBook') idBook: string,
		@Query() query: OfflineSyncQueryDto,
	) {
		return this.booksService.getOfflineSyncData(idBook, query.updatedSince);
	}

	@Get(':idBook/covers')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(3600)
	@ApiDocsGetBookCovers()
	@UseGuards(OptionalAuthGuard)
	getBookCovers(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getCovers(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/relationships')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiDocsGetBookRelationships()
	@UseGuards(OptionalAuthGuard)
	getBookRelationships(
		@Param('idBook') id: string,
		@Query() query: BookRelationshipsQueryDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getBookRelationships(
			id,
			query,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/infos')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiDocsGetBookInfos()
	@UseGuards(OptionalAuthGuard)
	getBookInfos(
		@Param('idBook') id: string,
		@Query('lang') queryLang?: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		const targetLang = queryLang || user?.contentLanguages?.[0];
		return this.booksService.getInfos(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
			targetLang,
		);
	}
}
