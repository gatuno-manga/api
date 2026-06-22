import { AddBookToCollectionUseCase } from '@/collections/application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from '@/collections/application/use-cases/create-collection.use-case';
import { DeleteCollectionUseCase } from '@/collections/application/use-cases/delete-collection.use-case';
import { GetUserCollectionsUseCase } from '@/collections/application/use-cases/get-user-collections.use-case';
import { ShareCollectionUseCase } from '@/collections/application/use-cases/share-collection.use-case';
import { AddBookDto } from '@/collections/infrastructure/http/dto/add-book.dto';
import { CreateCollectionDto } from '@/collections/infrastructure/http/dto/create-collection.dto';
import { ShareCollectionDto } from '@/collections/infrastructure/http/dto/share-collection.dto';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	Post,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsAddBook,
	ApiDocsCreate,
	ApiDocsDelete,
	ApiDocsGetMyCollections,
	ApiDocsShare,
} from './swagger/collections.swagger';

@ApiTags('Collections V2')
@Controller('collections')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class CollectionsController {
	constructor(
		private readonly createCollectionUseCase: CreateCollectionUseCase,
		private readonly deleteCollectionUseCase: DeleteCollectionUseCase,
		private readonly addBookToCollectionUseCase: AddBookToCollectionUseCase,
		private readonly shareCollectionUseCase: ShareCollectionUseCase,
		private readonly getUserCollectionsUseCase: GetUserCollectionsUseCase,
	) {}

	@Get()
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetMyCollections()
	async getMyCollections(@CurrentUser() user: CurrentUserDto) {
		const collections = await this.getUserCollectionsUseCase.execute(
			user.userId,
		);
		return collections.map((c) => c.toSnapshot());
	}

	@Post()
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
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
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
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
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
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

	@Delete(':id')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsDelete()
	async delete(@CurrentUser() user: CurrentUserDto, @Param('id') id: string) {
		try {
			await this.deleteCollectionUseCase.execute(user.userId, id);
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof DomainException) {
				throw new ForbiddenException(error.message);
			}
			throw error;
		}
	}
}
