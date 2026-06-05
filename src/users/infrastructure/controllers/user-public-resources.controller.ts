import { GetPublicCollectionsUseCase } from '@/collections/application/use-cases/get-public-collections.use-case';
import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseInterceptors,
} from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SavedPagesService } from '@users/application/use-cases/saved-pages.service';
import { UsersService } from '@users/application/use-cases/users.service';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsGetPublicCollections,
	ApiDocsGetPublicProfile,
	ApiDocsGetPublicSavedPages,
	ApiDocsGetPublicSavedPagesByBook,
} from './swagger/user-public-resources.swagger';

@ApiTags('Public User Resources')
@Controller('users/:userId/public')
@UseGuards(OptionalAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
export class UserPublicResourcesController {
	constructor(
		private readonly getPublicCollectionsUseCase: GetPublicCollectionsUseCase,
		private readonly savedPagesService: SavedPagesService,
		private readonly usersService: UsersService,
	) {}

	@Get('profile')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsGetPublicProfile()
	async getPublicProfile(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.usersService.getPublicUserProfile(userId);
	}

	@Get('collections')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsGetPublicCollections()
	async getPublicCollections(@Param('userId', ParseUUIDPipe) userId: string) {
		const collections =
			await this.getPublicCollectionsUseCase.execute(userId);
		return collections.map((c) => c.toSnapshot());
	}

	@Get('saved-pages')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsGetPublicSavedPages()
	async getPublicSavedPages(@Param('userId', ParseUUIDPipe) userId: string) {
		return this.savedPagesService.getPublicSavedPages(userId);
	}

	@Get('books/:bookId/saved-pages')
	@Permissions(PermissionsEnum.BOOKS_VIEW)
	@ApiDocsGetPublicSavedPagesByBook()
	async getPublicSavedPagesByBook(
		@Param('userId', ParseUUIDPipe) userId: string,
		@Param('bookId', ParseUUIDPipe) bookId: string,
	) {
		return this.savedPagesService.getPublicSavedPagesByBook(userId, bookId);
	}
}
