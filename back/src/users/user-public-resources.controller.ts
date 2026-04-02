import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { CollectionsBooksService } from './collections-books/collections-books.service';
import { SavedPagesService } from './saved-pages/saved-pages.service';

@ApiTags('Public User Resources')
@Controller('users/:userId/public')
@UseInterceptors(DataEnvelopeInterceptor)
export class UserPublicResourcesController {
	constructor(
		private readonly collectionsBooksService: CollectionsBooksService,
		private readonly savedPagesService: SavedPagesService,
	) {}

	@Get('collections')
	@ApiOperation({
		summary: 'Get public collections of a user',
		description: 'Retrieve collections that are marked as public',
	})
	@ApiParam({
		name: 'userId',
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Public collections retrieved' })
	async getPublicCollections(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.collectionsBooksService.getPublicCollections(userId);
	}

	@Get('saved-pages')
	@ApiOperation({
		summary: 'Get public saved pages of a user',
		description: 'Retrieve saved pages that are marked as public',
	})
	@ApiParam({
		name: 'userId',
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Public saved pages retrieved' })
	async getPublicSavedPages(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.savedPagesService.getPublicSavedPages(userId);
	}

	@Get('books/:bookId/saved-pages')
	@ApiOperation({
		summary: 'Get public saved pages of a user by book',
		description:
			'Retrieve public saved pages of a user filtered by a specific book',
	})
	@ApiParam({
		name: 'userId',
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'bookId',
		description: 'Book unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({
		status: 200,
		description: 'Public saved pages by book retrieved',
	})
	async getPublicSavedPagesByBook(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	) {
		return this.savedPagesService.getPublicSavedPagesByBook(userId, bookId);
	}
}
