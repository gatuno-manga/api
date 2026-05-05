import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { GetPublicCollectionsUseCase } from '@/collections/application/use-cases/get-public-collections.use-case';
import { SavedPagesService } from '@users/application/use-cases/saved-pages.service';
import { UsersService } from '@users/application/use-cases/users.service';
import {
	ApiDocsGetPublicProfile,
	ApiDocsGetPublicCollections,
	ApiDocsGetPublicSavedPages,
	ApiDocsGetPublicSavedPagesByBook,
} from './swagger/user-public-resources.swagger';

@ApiTags('Public User Resources')
@Controller('users/:userId/public')
@UseInterceptors(DataEnvelopeInterceptor)
export class UserPublicResourcesController {
	constructor(
		private readonly getPublicCollectionsUseCase: GetPublicCollectionsUseCase,
		private readonly savedPagesService: SavedPagesService,
		private readonly usersService: UsersService,
	) {}

	@Get('profile')
	@ApiDocsGetPublicProfile()
	async getPublicProfile(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.usersService.getPublicUserProfile(userId);
	}

	@Get('collections')
	@ApiDocsGetPublicCollections()
	async getPublicCollections(@Param('userId', ParseUUIDPipe) userId: string) {
		const collections =
			await this.getPublicCollectionsUseCase.execute(userId);
		return collections.map((c) => c.toSnapshot());
	}

	@Get('saved-pages')
	@ApiDocsGetPublicSavedPages()
	async getPublicSavedPages(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.savedPagesService.getPublicSavedPages(userId);
	}

	@Get('books/:bookId/saved-pages')
	@ApiDocsGetPublicSavedPagesByBook()
	async getPublicSavedPagesByBook(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	) {
		return this.savedPagesService.getPublicSavedPagesByBook(userId, bookId);
	}
}
