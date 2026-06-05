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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CollectionsBooksService } from '@users/application/use-cases/collections-books.service';
import { AddBookCollectionDto } from '@users/infrastructure/http/dto/add-book-collection.dto';
import { CreateCollectionBookDto } from '@users/infrastructure/http/dto/create-collection-book.dto';
import { UpdateCollectionVisibilityDto } from '@users/infrastructure/http/dto/update-collection-visibility.dto';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsAddBookToCollection,
	ApiDocsCreateCollectionBook,
	ApiDocsDeleteCollection,
	ApiDocsGetCollectionBooks,
	ApiDocsGetCollectionById,
	ApiDocsGetNameCollectionBooks,
	ApiDocsRemoveBookFromCollection,
	ApiDocsUpdateVisibility,
} from './swagger/collections-books.swagger';

@ApiTags('Collections')
@Controller('users/me/collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class CollectionsBooksController {
	constructor(
		private readonly collectionsBooksService: CollectionsBooksService,
	) {}

	@Get()
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetCollectionBooks()
	async getCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getCollections(user.userId);
	}

	@Get('names')
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetNameCollectionBooks()
	async getNameCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getNameCollectionBooks(user.userId);
	}

	@Get(':idCollection')
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetCollectionById()
	async getCollectionById(
		@Param('idCollection') idCollection: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.getCollectionBooks(
			user.userId,
			idCollection,
		);
	}

	@Post()
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsCreateCollectionBook()
	async createCollectionBook(
		@Body() dto: CreateCollectionBookDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.createCollectionBook(
			dto,
			user.userId,
		);
	}

	@Post(':idCollection/books')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsAddBookToCollection()
	async addBookToCollection(
		@Body() dto: AddBookCollectionDto,
		@Param('idCollection') idCollection: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.addBookToCollection(
			dto,
			idCollection,
			user.userId,
		);
	}

	@Delete(':idCollection/books/:idBook')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsRemoveBookFromCollection()
	async removeBookFromCollection(
		@Param('idCollection') idCollection: string,
		@Param('idBook') idBook: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.removeBookFromCollection(
			idCollection,
			idBook,
			user.userId,
		);
	}

	@Delete(':idCollection')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsDeleteCollection()
	async deleteCollection(
		@Param('idCollection') idCollection: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.deleteCollection(
			idCollection,
			user.userId,
		);
	}

	@Patch(':idCollection/visibility')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsUpdateVisibility()
	async updateVisibility(
		@Param('idCollection') idCollection: string,
		@Body() dto: UpdateCollectionVisibilityDto,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.updateCollectionVisibility(
			idCollection,
			user.userId,
			dto.isPublic,
		);
	}
}
