import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CollectionsBooksService } from './collections-books.service';
import { AddBookCollectionDto } from './dto/add-book-collection.dto';
import { CreateCollectionBookDto } from './dto/create-collection-book.dto';

@ApiTags('Collections')
@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionsBooksController {
	constructor(
		private readonly collectionsBooksService: CollectionsBooksService,
	) {}

	@Get()
	@ApiOperation({
		summary: 'Get all user collections',
		description: 'Retrieve all book collections for the current user',
	})
	@ApiResponse({
		status: 200,
		description: 'Collections retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async getCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getCollections(user.userId);
	}

	@Get('names')
	@ApiOperation({
		summary: 'Get collection names',
		description: 'Retrieve only the names of all collections',
	})
	@ApiResponse({
		status: 200,
		description: 'Collection names retrieved successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async getNameCollectionBooks(@CurrentUser() user: CurrentUserDto) {
		return this.collectionsBooksService.getNameCollectionBooks(user.userId);
	}

	@Get(':idCollection')
	@ApiOperation({
		summary: 'Get collection by ID',
		description: 'Retrieve a specific collection with all its books',
	})
	@ApiParam({
		name: 'idCollection',
		description: 'Collection unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Collection found' })
	@ApiResponse({ status: 404, description: 'Collection not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
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
	@ApiOperation({
		summary: 'Create a new collection',
		description: 'Create a new book collection for the user',
	})
	@ApiResponse({
		status: 201,
		description: 'Collection created successfully',
	})
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
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
	@ApiOperation({
		summary: 'Add books to collection',
		description: 'Add one or more books to an existing collection',
	})
	@ApiParam({
		name: 'idCollection',
		description: 'Collection unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Books added successfully' })
	@ApiResponse({ status: 404, description: 'Collection not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
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
	@ApiOperation({
		summary: 'Remove book from collection',
		description: 'Remove a specific book from a collection',
	})
	@ApiParam({
		name: 'idCollection',
		description: 'Collection unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiParam({
		name: 'idBook',
		description: 'Book unique identifier',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@ApiResponse({ status: 200, description: 'Book removed successfully' })
	@ApiResponse({ status: 404, description: 'Collection or book not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
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
	@ApiOperation({
		summary: 'Delete collection',
		description: 'Delete an entire collection',
	})
	@ApiParam({
		name: 'idCollection',
		description: 'Collection unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Collection deleted successfully',
	})
	@ApiResponse({ status: 404, description: 'Collection not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	async deleteCollection(
		@Param('idCollection') idCollection: string,
		@CurrentUser() user: CurrentUserDto,
	) {
		return this.collectionsBooksService.deleteCollection(
			idCollection,
			user.userId,
		);
	}
}
