import { UserId } from '@common/domain/value-objects/user-id.vo';
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
import { SavedPagesService } from '@users/application/use-cases/saved-pages.service';
import { CreateSavedPageDto } from '@users/infrastructure/http/dto/create-saved-page.dto';
import { UpdateSavedPageDto } from '@users/infrastructure/http/dto/update-saved-page.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsCountSavedPagesByBook,
	ApiDocsGetSavedPage,
	ApiDocsGetSavedPages,
	ApiDocsGetSavedPagesByBook,
	ApiDocsGetSavedPagesByChapter,
	ApiDocsIsPageSaved,
	ApiDocsSavePage,
	ApiDocsUnsavePage,
	ApiDocsUnsavePageByPageId,
	ApiDocsUpdateComment,
	ApiDocsUpdateVisibility,
} from './swagger/saved-pages.swagger';

@ApiTags('Saved Pages')
@Controller('users/me/saved-pages')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
@UseInterceptors(DataEnvelopeInterceptor)
export class SavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Post()
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsSavePage()
	async savePage(
		@Body() dto: CreateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.savePage(dto, user.userId);
	}

	@Get()
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsGetSavedPages()
	async getSavedPages(@CurrentUser() user: CurrentUserDto) {
		return this.savedPagesService.getSavedPages(user.userId);
	}

	@Get('book/:bookId')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsGetSavedPagesByBook()
	async getSavedPagesByBook(
		@Param('bookId') bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}

	@Get('chapter/:chapterId')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
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
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
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
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
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
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsGetSavedPage()
	async getSavedPage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPage(id, user.userId);
	}

	@Patch(':id')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsUpdateComment()
	async updateComment(
		@Param('id') id: string,
		@Body() dto: UpdateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.updateComment(id, dto, user.userId);
	}

	@Delete(':id')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsUnsavePage()
	async unsavePage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePage(id, user.userId);
		return { message: 'Page unsaved successfully' };
	}

	@Delete('page/:pageId')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
	@ApiDocsUnsavePageByPageId()
	async unsavePageByPageId(
		@Param('pageId', ParseIntPipe) pageId: number,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePageByPageId(
			pageId,
			UserId.create(user.userId),
		);
		return { message: 'Page unsaved successfully' };
	}

	@Patch(':id/visibility')
	@Permissions(PermissionsEnum.SAVED_PAGES_MANAGE)
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
