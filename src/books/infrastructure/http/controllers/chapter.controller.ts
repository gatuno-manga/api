import { CacheTTL } from '@nestjs/cache-manager';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { AuthenticatedApi } from 'src/common/swagger/auth-api.decorators';
import { ChapterService } from '@books/application/services/chapter.service';
import {
	ApiDocsGetChapter,
	ApiDocsGetChaptersBatch,
	ApiDocsGetChaptersWithLessPages,
	ApiDocsMarkChapterAsRead,
	ApiDocsMarkChapterAsUnread,
	ApiDocsMarkChaptersAsRead,
	ApiDocsMarkChaptersAsUnread,
	ApiDocsResetAllChapters,
	ApiDocsResetChapter,
} from './swagger/chapter.swagger';

@ApiTags('Chapters')
@Controller('chapters')
export class ChapterController {
	constructor(private readonly chapterService: ChapterService) {}

	@Get(':idChapter')
	@Throttle({ long: { limit: 200, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	@ApiDocsGetChapter()
	@UseGuards(OptionalAuthGuard)
	getChapter(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.chapterService.getChapter(idChapter, user?.userId);
	}

	@Patch(':idChapter/reset/')
	@AuthenticatedApi()
	@ApiDocsResetChapter()
	resetChapter(@Param('idChapter') idChapter: string) {
		return this.chapterService.resetChapter(idChapter);
	}

	@Patch('/reset')
	@AuthenticatedApi()
	@ApiDocsResetAllChapters()
	resetAllChapters(@Body() body: string[]) {
		return this.chapterService.resetAllChapters(body);
	}

	@Get('/:idChapter/read/')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiDocsMarkChapterAsRead()
	markChapterAsRead(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChapterAsRead(idChapter, user.userId);
	}

	@Delete('/:idChapter/read/')
	@Throttle({ medium: { limit: 50, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiDocsMarkChapterAsUnread()
	markChapterAsUnread(
		@Param('idChapter') idChapter: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChapterAsUnread(idChapter, user.userId);
	}

	@Post('batch/read')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiDocsMarkChaptersAsRead()
	markChaptersAsRead(
		@Body() chapterIds: string[],
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChaptersAsRead(chapterIds, user.userId);
	}

	@Post('batch/unread')
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@AuthenticatedApi()
	@ApiDocsMarkChaptersAsUnread()
	markChaptersAsUnread(
		@Body() chapterIds: string[],
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.chapterService.markChaptersAsUnread(
			chapterIds,
			user.userId,
		);
	}

	@Get('less-pages/:pages')
	@AuthenticatedApi()
	@ApiDocsGetChaptersWithLessPages()
	getChaptersWithLessPages(@Param('pages') pages: number) {
		return this.chapterService.listLessPages(pages);
	}

	@Post('batch/data')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@ApiDocsGetChaptersBatch()
	@UseGuards(OptionalAuthGuard)
	getChaptersBatch(@Body() chapterIds: string[]) {
		return this.chapterService.getChaptersBatch(chapterIds);
	}
}
