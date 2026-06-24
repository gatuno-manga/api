import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@/books/application/ports/book-repository.interface';
import { GetFavoritesUseCase } from '@/interactions/application/use-cases/get-favorites.use-case';
import { CurrentUserDto } from '@auth/application/dto/current-user.dto';
import { CurrentUser } from '@auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from '@auth/infrastructure/framework/jwt-auth.guard';
import { UserId } from '@common/domain/value-objects/user-id.vo';
import { DataEnvelopeInterceptor } from '@common/interceptors/data-envelope.interceptor';
import { SWAGGER_AUTH_SCHEME } from '@common/swagger/swagger-auth.constants';
import {
	Controller,
	Get,
	Inject,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import { FavoritesCursorOptionsDto } from '../http/dto/favorites-cursor-options.dto';
import { ApiDocsGetFavorites } from './swagger/interactions.swagger';

@ApiTags('Interactions')
@Controller('interactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DataEnvelopeInterceptor)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class UserInteractionsController {
	constructor(
		private readonly getFavoritesUseCase: GetFavoritesUseCase,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
	) {}

	@Get('favorites')
	@Permissions(PermissionsEnum.INTERACTIONS_MANAGE)
	@ApiDocsGetFavorites()
	async getFavorites(
		@CurrentUser() user: CurrentUserDto,
		@Query() options: FavoritesCursorOptionsDto,
	) {
		const userId = UserId.create(user.userId);
		const page = await this.getFavoritesUseCase.execute(
			userId,
			options.limit,
			options.cursor,
		);

		if (page.data.length === 0) {
			const isPageDto = page instanceof PageDto;
			if (isPageDto) {
				return new PageDto([], page.metadata);
			}

			return new CursorPageDto([], page.nextCursor, page.hasNextPage);
		}

		const snapshots = page.data.map((f) => f.toSnapshot());
		const bookIds = snapshots.map((f) => f.bookId);
		const books =
			await this.bookRepository.findByIdsPreservingOrder(bookIds);

		const mappedData = snapshots.map((favorite) => {
			const book = books.find((b) => b.id === favorite.bookId);
			return {
				...favorite,
				book: book
					? {
							id: book.id,
							title: book.title,
							type: book.type,
							covers: book.covers,
							publicationStatus: book.publicationStatus,
							scrapingStatus: book.scrapingStatus,
						}
					: null,
			};
		});

		const isPageDto = page instanceof PageDto;
		if (isPageDto) {
			return new PageDto(mappedData, page.metadata);
		}

		return new CursorPageDto(mappedData, page.nextCursor, page.hasNextPage);
	}
}
