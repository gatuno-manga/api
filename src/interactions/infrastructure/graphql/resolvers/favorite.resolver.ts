import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from '@/auth/infrastructure/framework/gql-current-user.decorator';
import { JwtAuthGuard } from '@/auth/infrastructure/framework/jwt-auth.guard';
import {
	IBookRepository,
	I_BOOK_REPOSITORY,
} from '@/books/application/ports/book-repository.interface';
import { BookModel } from '@/books/infrastructure/graphql/models/book.model';
import { UserId } from '@/common/domain/value-objects/user-id.vo';
import { PageDto } from '@/common/pagination/page.dto';
import { GetFavoritesUseCase } from '@/interactions/application/use-cases/get-favorites.use-case';
import {
	FavoriteModel,
	PaginatedFavoriteResponseModel,
} from '@/interactions/infrastructure/graphql/models/favorite.model';
import { Inject, UseGuards } from '@nestjs/common';
import {
	Args,
	Int,
	Parent,
	Query,
	ResolveField,
	Resolver,
} from '@nestjs/graphql';

@Resolver(() => FavoriteModel)
export class FavoriteResolver {
	constructor(
		private readonly getFavoritesUseCase: GetFavoritesUseCase,
		@Inject(I_BOOK_REPOSITORY)
		private readonly bookRepository: IBookRepository,
	) {}

	@Query(() => PaginatedFavoriteResponseModel, { name: 'myFavorites' })
	@UseGuards(JwtAuthGuard)
	async getMyFavorites(
		@GqlCurrentUser() user: CurrentUserDto,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
		limit: number,
		@Args('page', { type: () => Int, nullable: true }) page?: number,
		@Args('cursor', { type: () => String, nullable: true }) cursor?: string,
	): Promise<PaginatedFavoriteResponseModel> {
		const result = await this.getFavoritesUseCase.execute(
			UserId.create(user.userId),
			limit,
			cursor,
			page,
		);

		const isPageDto = result instanceof PageDto;

		return {
			data: result.data.map((f) => {
				const snapshot = f.toSnapshot();
				return {
					userId: snapshot.userId,
					bookId: snapshot.bookId,
					createdAt: snapshot.createdAt,
				};
			}),
			nextCursor: isPageDto ? undefined : result.nextCursor || undefined,
			hasNextPage: isPageDto ? false : result.hasNextPage,
			total: isPageDto ? result.metadata.total : undefined,
			page: isPageDto ? result.metadata.page : undefined,
			lastPage: isPageDto ? result.metadata.lastPage : undefined,
		};
	}

	@ResolveField(() => BookModel, { name: 'book' })
	async getBook(@Parent() favorite: FavoriteModel) {
		const books = await this.bookRepository.findByIdsPreservingOrder([
			favorite.bookId,
		]);
		const book = books[0];
		if (!book) {
			return null;
		}

		return book;
	}
}
