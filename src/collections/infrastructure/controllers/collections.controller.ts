import { AddBookToCollectionUseCase } from '@/collections/application/use-cases/add-book-to-collection.use-case';
import { CreateCollectionUseCase } from '@/collections/application/use-cases/create-collection.use-case';
import { DeleteCollectionUseCase } from '@/collections/application/use-cases/delete-collection.use-case';
import { GetCollectionBookCoversUseCase } from '@/collections/application/use-cases/get-collection-book-covers.use-case';
import { GetUserCollectionsUseCase } from '@/collections/application/use-cases/get-user-collections.use-case';
import { ShareCollectionUseCase } from '@/collections/application/use-cases/share-collection.use-case';
import { UpdateCollectionCoverUseCase } from '@/collections/application/use-cases/update-collection-cover.use-case';
import { UpdateCollectionUseCase } from '@/collections/application/use-cases/update-collection.use-case';
import { UploadCollectionCoverUseCase } from '@/collections/application/use-cases/upload-collection-cover.use-case';
import { AddBookDto } from '@/collections/infrastructure/http/dto/add-book.dto';
import { CreateCollectionDto } from '@/collections/infrastructure/http/dto/create-collection.dto';
import { ShareCollectionDto } from '@/collections/infrastructure/http/dto/share-collection.dto';
import { UpdateCollectionCoverDto } from '@/collections/infrastructure/http/dto/update-collection-cover.dto';
import { UpdateCollectionDto } from '@/collections/infrastructure/http/dto/update-collection.dto';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { DomainException } from '@common/domain/exceptions/domain.exception';
import { ResourceNotFoundException } from '@common/domain/exceptions/resource-not-found.exception';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	BadRequestException,
	Body,
	ConflictException,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	Put,
	Query,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	ApiBearerAuth,
	ApiBody,
	ApiConsumes,
	ApiOperation,
	ApiTags,
} from '@nestjs/swagger';
import { PageDto } from 'src/common/pagination/page.dto';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsAddBook,
	ApiDocsCreate,
	ApiDocsDelete,
	ApiDocsGetCollectionBookCovers,
	ApiDocsGetMyCollections,
	ApiDocsShare,
	ApiDocsUpdateCover,
} from './swagger/collections.swagger';

@ApiTags('Collections')
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
		private readonly updateCollectionCoverUseCase: UpdateCollectionCoverUseCase,
		private readonly uploadCollectionCoverUseCase: UploadCollectionCoverUseCase,
		private readonly getCollectionBookCoversUseCase: GetCollectionBookCoversUseCase,
		private readonly updateCollectionUseCase: UpdateCollectionUseCase,
	) {}

	@Get()
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetMyCollections()
	async getMyCollections(
		@CurrentUser() user: CurrentUserDto,
		@Query('limit') limit?: string,
		@Query('cursor') cursor?: string,
		@Query('page') page?: string,
	) {
		const numLimit = limit ? Number.parseInt(limit, 10) : 20;
		const numPage = page ? Number.parseInt(page, 10) : undefined;
		const result = await this.getUserCollectionsUseCase.execute(
			user.userId,
			numLimit,
			cursor,
			numPage,
		);

		const isPageDto = result instanceof PageDto;

		return {
			data: result.data.map((c) => c.toSnapshot()),
			nextCursor: isPageDto ? undefined : result.nextCursor,
			hasNextPage: isPageDto ? undefined : result.hasNextPage,
			metadata: isPageDto ? result.metadata : undefined,
		};
	}

	@Post()
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsCreate()
	async create(
		@CurrentUser() user: CurrentUserDto,
		@Body() dto: CreateCollectionDto,
	) {
		try {
			return await this.createCollectionUseCase.execute(
				user.userId,
				dto.title,
				dto.description,
				dto.id,
			);
		} catch (error) {
			if (
				error instanceof DomainException &&
				error.message === 'Collection with this ID already exists'
			) {
				throw new ConflictException(error.message);
			}
			throw error;
		}
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
			user.maxWeightSensitiveContent,
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

	@Put(':id')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	async update(
		@CurrentUser() user: CurrentUserDto,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateCollectionDto,
	) {
		try {
			await this.updateCollectionUseCase.execute(user.userId, id, dto);
			return { message: 'Collection updated successfully' };
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof DomainException) {
				if (error.message.includes('Only the owner')) {
					throw new ForbiddenException(error.message);
				}
				throw new BadRequestException(error.message);
			}
			throw error;
		}
	}

	@Delete(':id')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsDelete()
	async delete(
		@CurrentUser() user: CurrentUserDto,
		@Param('id', ParseUUIDPipe) id: string,
	) {
		try {
			await this.deleteCollectionUseCase.execute(user.userId, id);
			return { message: 'Collection deleted successfully' };
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

	@Patch(':id/cover')
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiDocsUpdateCover()
	async updateCover(
		@CurrentUser() user: CurrentUserDto,
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateCollectionCoverDto,
	) {
		try {
			await this.updateCollectionCoverUseCase.execute(
				user.userId,
				id,
				dto.coverUrl || null,
			);
			return { message: 'Collection cover updated successfully' };
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

	@Post(':id/cover/upload')
	@UseInterceptors(FileInterceptor('file'))
	@Permissions(PermissionsEnum.COLLECTIONS_MANAGE)
	@ApiOperation({ summary: 'Upload a custom cover for the collection' })
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				file: {
					type: 'string',
					format: 'binary',
				},
			},
		},
	})
	async uploadCover(
		@CurrentUser() user: CurrentUserDto,
		@Param('id', ParseUUIDPipe) id: string,
		@UploadedFile() file: Express.Multer.File,
	) {
		try {
			await this.uploadCollectionCoverUseCase.execute(user.userId, id, {
				buffer: file.buffer,
				mimetype: file.mimetype,
				size: file.size,
			});
			return { message: 'Collection cover uploaded successfully' };
		} catch (error) {
			if (error instanceof ResourceNotFoundException) {
				throw new NotFoundException(error.message);
			}
			if (error instanceof DomainException) {
				if (error.message.includes('Only the owner')) {
					throw new ForbiddenException(error.message);
				}
				throw new BadRequestException(error.message);
			}
			throw error;
		}
	}

	@Get(':id/books/covers')
	@Permissions(PermissionsEnum.COLLECTIONS_VIEW)
	@ApiDocsGetCollectionBookCovers()
	async getCollectionBookCovers(
		@CurrentUser() user: CurrentUserDto,
		@Param('id', ParseUUIDPipe) id: string,
		@Query('limit') limit?: string,
	) {
		const numLimit = limit ? Number.parseInt(limit, 10) : 4;
		return this.getCollectionBookCoversUseCase.execute(
			user.userId,
			id,
			numLimit,
		);
	}
}
