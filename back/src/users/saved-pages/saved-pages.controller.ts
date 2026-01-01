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
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { SavedPagesService } from './saved-pages.service';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CreateSavedPageDto } from './dto/create-saved-page.dto';
import { UpdateSavedPageDto } from './dto/update-saved-page.dto';

@ApiTags('Saved Pages')
@Controller('saved-pages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SavedPagesController {
	constructor(private readonly savedPagesService: SavedPagesService) {}

	@Post()
	@ApiOperation({
		summary: 'Save a page',
		description: 'Save a page to your favorites with an optional comment',
	})
	@ApiResponse({ status: 201, description: 'Page saved successfully' })
	@ApiResponse({
		status: 400,
		description: 'Page already saved or invalid data',
	})
	@ApiResponse({ status: 404, description: 'Page not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async savePage(
		@Body() dto: CreateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.savePage(dto, user.userId);
	}

	@Get()
	@ApiOperation({
		summary: 'Get all saved pages',
		description: 'Retrieve all saved pages for the current user',
	})
	@ApiResponse({
		status: 200,
		description: 'Saved pages retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getSavedPages(@CurrentUser() user: CurrentUserDto) {
		return this.savedPagesService.getSavedPages(user.userId);
	}

	@Get('book/:bookId')
	@ApiOperation({
		summary: 'Get saved pages by book',
		description: 'Retrieve all saved pages for a specific book',
	})
	@ApiParam({
		name: 'bookId',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Saved pages retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getSavedPagesByBook(
		@Param('bookId') bookId: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPagesByBook(user.userId, bookId);
	}

	@Get('chapter/:chapterId')
	@ApiOperation({
		summary: 'Get saved pages by chapter',
		description: 'Retrieve all saved pages for a specific chapter',
	})
	@ApiParam({
		name: 'chapterId',
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Saved pages retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
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
	@ApiOperation({
		summary: 'Check if page is saved',
		description: 'Check if a specific page is saved by the user',
	})
	@ApiParam({
		name: 'pageId',
		description: 'Page ID',
		example: 1,
	})
	@ApiResponse({
		status: 200,
		description: 'Returns whether the page is saved',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
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
	@ApiOperation({
		summary: 'Count saved pages by book',
		description: 'Get the count of saved pages for a specific book',
	})
	@ApiParam({
		name: 'bookId',
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Count retrieved successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
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
	@ApiOperation({
		summary: 'Get saved page by ID',
		description: 'Retrieve a specific saved page with all details',
	})
	@ApiParam({
		name: 'id',
		description: 'Saved page unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Saved page found' })
	@ApiResponse({ status: 404, description: 'Saved page not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async getSavedPage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.getSavedPage(id, user.userId);
	}

	@Patch(':id')
	@ApiOperation({
		summary: 'Update saved page comment',
		description: 'Update the comment on a saved page',
	})
	@ApiParam({
		name: 'id',
		description: 'Saved page unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Comment updated successfully' })
	@ApiResponse({ status: 404, description: 'Saved page not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async updateComment(
		@Param('id') id: string,
		@Body() dto: UpdateSavedPageDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.savedPagesService.updateComment(id, dto, user.userId);
	}

	@Delete(':id')
	@ApiOperation({
		summary: 'Unsave a page',
		description: 'Remove a page from saved pages by saved page ID',
	})
	@ApiParam({
		name: 'id',
		description: 'Saved page unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Page unsaved successfully' })
	@ApiResponse({ status: 404, description: 'Saved page not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async unsavePage(
		@Param('id') id: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePage(id, user.userId);
		return { message: 'Page unsaved successfully' };
	}

	@Delete('page/:pageId')
	@ApiOperation({
		summary: 'Unsave a page by page ID',
		description:
			'Remove a page from saved pages using the original page ID',
	})
	@ApiParam({
		name: 'pageId',
		description: 'Original page ID',
		example: 1,
	})
	@ApiResponse({ status: 200, description: 'Page unsaved successfully' })
	@ApiResponse({ status: 404, description: 'Saved page not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async unsavePageByPageId(
		@Param('pageId', ParseIntPipe) pageId: number,
		@CurrentUser() user: CurrentUserDto,
	) {
		await this.savedPagesService.unsavePageByPageId(pageId, user.userId);
		return { message: 'Page unsaved successfully' };
	}
}
