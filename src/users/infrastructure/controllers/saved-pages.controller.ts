import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { CreateSavedPageDto } from '../http/dto/create-saved-page.dto';
import { UpdateSavedPageDto } from '../http/dto/update-saved-page.dto';
import { SavedPagesService } from '../../application/use-cases/saved-pages.service';
import {
	ApiDocsSavePage,
	ApiDocsGetSavedPages,
	ApiDocsGetSavedPagesByBook,
	ApiDocsGetSavedPagesByChapter,
	ApiDocsIsPageSaved,
	ApiDocsCountSavedPagesByBook,
	ApiDocsGetSavedPage,
	ApiDocsUpdateComment,
	ApiDocsUnsavePage,
	ApiDocsUnsavePageByPageId,
	ApiDocsUpdateVisibility,
} from './swagger/saved-pages.swagger';

@ApiTags('Saved Pages')
@Controller('users/me/saved-pages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
@UseInterceptors(DataEnvelopeInterceptor)
export class SavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Post()
	@ApiDocsSavePage()
	async savePage(
		@Body() dto: CreateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.savePage(dto, user.userId);
	}

	@Get()
	@ApiDocsGetSavedPages()
	async getSavedPages(@CurrentUser() user: CurrentUserDto) {
		return this.savedPagesService.getSavedPages(user.userId);
	}

	@Get('book/:bookId')
	@ApiDocsGetSavedPagesByBook()
	async getSavedPagesByBook(
		@Param('bookId') bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}

	@Get('chapter/:chapterId')
	@ApiDocsGetSavedPagesByChapter()
	async getSavedPagesByChapter(
		@Param('chapterId') chapterId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByChapter(
			user.userId,
			chapterId,
		);
	}

	@Get('check/:pageId')
	@ApiDocsIsPageSaved()
	async isPageSaved(
		@Param('pageId', ParseIntPipe) pageId: number,
		@CurrentUser() user: CurrentUserDto,
	) {
		const isSaved = await this.savedPagesService.isPageSaved(
			pageId,
			user.userId,
		);
		return { pageId, isSaved };
	}

	@Get('count/book/:bookId')
	@ApiDocsCountSavedPagesByBook()
	async countSavedPagesByBook(
		@Param('bookId') bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		const count = await this.savedPagesService.countSavedPagesByBook(
			user.userId,
			bookId,
		);
		return { bookId, count };
	}

	@Get(':id')
	@ApiDocsGetSavedPage()
	async getSavedPage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPage(id, user.userId);
	}

	@Patch(':id')
	@ApiDocsUpdateComment()
	async updateComment(
		@Param('id') id: string,
		@Body() dto: UpdateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.updateComment(id, dto, user.userId);
	}

	@Delete(':id')
	@ApiDocsUnsavePage()
	async unsavePage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePage(id, user.userId);
		return { message: 'Page unsaved successfully' };
	}

	@Delete('page/:pageId')
	@ApiDocsUnsavePageByPageId()
	async unsavePageByPageId(
		@Param('pageId', ParseIntPipe) pageId: number,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePageByPageId(pageId, user.userId);
		return { message: 'Page unsaved successfully' };
	}

	@Patch(':id/visibility')
	@ApiDocsUpdateVisibility()
	async updateVisibility(
		@Param('id') id: string,
		@Body() dto: UpdateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.updateVisibility(
			id,
			dto.isPublic ?? false,
			user.userId,
		);
	}
}
