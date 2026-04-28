import {
	Body,
	Controller,
	Get,
	Post,
	UseGuards,
	UseInterceptors,
	Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/infrastructure/framework/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from '../../../auth/application/dto/current-user.dto';
import { DataEnvelopeInterceptor } from '../../../common/interceptors/data-envelope.interceptor';
import { CreateCollectionUseCase } from '../../application/use-cases/create-collection.use-case';
import { AddBookToCollectionUseCase } from '../../application/use-cases/add-book-to-collection.use-case';
import { ShareCollectionUseCase } from '../../application/use-cases/share-collection.use-case';
import { GetUserCollectionsUseCase } from '../../application/use-cases/get-user-collections.use-case';
import { CreateCollectionDto } from '../http/dto/create-collection.dto';
import { AddBookDto } from '../http/dto/add-book.dto';
import { ShareCollectionDto } from '../http/dto/share-collection.dto';
import { SWAGGER_AUTH_SCHEME } from '../../../common/swagger/swagger-auth.constants';

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
	@ApiOperation({ summary: 'Get my collections' })
	async getMyCollections(@CurrentUser() user: CurrentUserDto) {
		const collections = await this.getUserCollectionsUseCase.execute(
			user.userId,
		);
		return collections.map((c) => c.toSnapshot());
	}

	@Post()
	@ApiOperation({ summary: 'Create a collection' })
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
	@ApiOperation({ summary: 'Add a book to a collection' })
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
	@ApiOperation({ summary: 'Share a collection with a collaborator' })
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
