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
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from 'src/common/interceptors/data-envelope.interceptor';
import { CollectionsBooksService } from '../../application/use-cases/collections-books.service';
import { AddBookCollectionDto } from '../http/dto/add-book-collection.dto';
import { CreateCollectionBookDto } from '../http/dto/create-collection-book.dto';
import { UpdateCollectionVisibilityDto } from '../http/dto/update-collection-visibility.dto';
import {
	ApiDocsGetCollectionBooks,
	ApiDocsGetNameCollectionBooks,
	ApiDocsGetCollectionById,
	ApiDocsCreateCollectionBook,
	ApiDocsAddBookToCollection,
	ApiDocsRemoveBookFromCollection,
	ApiDocsDeleteCollection,
	ApiDocsUpdateVisibility,
} from './swagger/collections-books.swagger';

@ApiTags('Collections')
@Controller('users/me/collections')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class CollectionsBooksController {
	constructor(
		private readonly collectionsBooksService: CollectionsBooksService,
	) {}

	@Get()
	@ApiDocsGetCollectionBooks()
	async getCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getCollections(user.userId);
	}

	@Get('names')
	@ApiDocsGetNameCollectionBooks()
	async getNameCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getNameCollectionBooks(user.userId);
	}

	@Get(':idCollection')
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
