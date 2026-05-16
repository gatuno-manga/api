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
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { BooksService } from '@books/application/services/books.service';
import { BookChaptersCursorPageDto } from '@books/application/dto/book-chapters-cursor-page.dto';
import { BookChaptersCursorOptionsDto } from '@books/application/dto/book-chapters-cursor-options.dto';
import { BookRelationshipsQueryDto } from '@books/application/dto/book-relationships-query.dto';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import {
	ApiDocsCheckBookTitle,
	ApiDocsGetAllBooks,
	ApiDocsGetBook,
	ApiDocsGetBookChapters,
	ApiDocsGetBookCovers,
	ApiDocsGetBookInfos,
	ApiDocsGetBookRelationships,
	ApiDocsGetRandomBook,
} from './swagger/books.swagger';

@ApiTags('Books')
@Controller('books')
export class BooksController {
	constructor(private readonly booksService: BooksService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(180)
	@ApiDocsGetAllBooks()
	@UseGuards(OptionalAuthGuard)
	getAllBooks(
		@Query() pageOptions: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getAllBooks(
			pageOptions,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get('random')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(60)
	@ApiDocsGetRandomBook()
	@UseGuards(OptionalAuthGuard)
	getRandomBook(
		@Query() options: BookPageOptionsDto,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getRandomBook(
			options,
			user?.maxWeightSensitiveContent,
			user?.userId,
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
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiDocsGetBook()
	@UseGuards(OptionalAuthGuard)
	getBook(@Param('idBook') id: string, @CurrentUser() user?: CurrentUserDto) {
		return this.booksService.getOne(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}

	@Get(':idBook/chapters')
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

	@Get(':idBook/covers')
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
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiDocsGetBookInfos()
	@UseGuards(OptionalAuthGuard)
	getBookInfos(
		@Param('idBook') id: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.booksService.getInfos(
			id,
			user?.maxWeightSensitiveContent,
			user?.userId,
		);
	}
}
