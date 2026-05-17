import { AddBookToCollectionUseCase } from '@/collections/application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from '@/collections/application/use-cases/create-collection.use-case';
import { GetUserCollectionsUseCase } from '@/collections/application/use-cases/get-user-collections.use-case';
import { ShareCollectionUseCase } from '@/collections/application/use-cases/share-collection.use-case';
import { AddBookDto } from '@/collections/infrastructure/http/dto/add-book.dto';
import { CreateCollectionDto } from '@/collections/infrastructure/http/dto/create-collection.dto';
import { ShareCollectionDto } from '@/collections/infrastructure/http/dto/share-collection.dto';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
	ApiDocsAddBook,
	ApiDocsCreate,
	ApiDocsGetMyCollections,
	ApiDocsShare,
} from './swagger/collections.swagger';

@ApiTags('Collections V2')
@Controller('collections')
@UseGuards(JwtAuthGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class CollectionsController {
	constructor(
		private readonly createCollectionUseCase: CreateCollectionUseCase,
		private readonly addBookToCollectionUseCase: AddBookToCollectionUseCase,
		private readonly shareCollectionUseCase: ShareCollectionUseCase,
		private readonly getUserCollectionsUseCase: GetUserCollectionsUseCase,
	) {}

	@Get()
	@ApiDocsGetMyCollections()
	async getMyCollections(@CurrentUser() user: CurrentUserDto) {
		const collections = await this.getUserCollectionsUseCase.execute(
			user.userId,
		);
		return collections.map((c) => c.toSnapshot());
	}

	@Post()
	@ApiDocsCreate()
	async create(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: CreateCollectionDto,
	) {
		return this.createCollectionUseCase.execute(
			user.userId,
			dto.title,
			dto.description,
		);
	}

	@Post(':id/books')
	@ApiDocsAddBook()
	async addBook(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
		@Body() dto: AddBookDto,
	) {
		return this.addBookToCollectionUseCase.execute(
			user.userId,
			id,
			dto.bookId,
		);
	}

	@Post(':id/share')
	@ApiDocsShare()
	async share(
		@CurrentUser() user: CurrentUserDto,
		@Param('id') id: string,
		@Body() dto: ShareCollectionDto,
	) {
		return this.shareCollectionUseCase.execute(
			user.userId,
			id,
			dto.collaboratorId,
		);
	}
}
