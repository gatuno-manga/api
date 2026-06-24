import { CurrentUserDto } from '@/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from '@/auth/infrastructure/framework/gql-current-user.decorator';
import { JwtAuthGuard } from '@/auth/infrastructure/framework/jwt-auth.guard';
import { CoverModel } from '@/books/infrastructure/graphql/models/book.model';
import { GetCollectionBookCoversUseCase } from '@/collections/application/use-cases/get-collection-book-covers.use-case';
import { GetUserCollectionsUseCase } from '@/collections/application/use-cases/get-user-collections.use-case';
import {
	CollectionModel,
	PaginatedCollectionResponseModel,
} from '@/collections/infrastructure/graphql/models/collection.model';
import { UseGuards } from '@nestjs/common';
import {
	Args,
	Int,
	Parent,
	Query,
	ResolveField,
	Resolver,
} from '@nestjs/graphql';
import { PageDto } from 'src/common/pagination/page.dto';

@Resolver(() => CollectionModel)
export class CollectionResolver {
	constructor(
		private readonly getUserCollectionsUseCase: GetUserCollectionsUseCase,
		private readonly getCollectionBookCoversUseCase: GetCollectionBookCoversUseCase,
	) {}

	@Query(() => PaginatedCollectionResponseModel, { name: 'myCollections' })
	@UseGuards(JwtAuthGuard)
	async getMyCollections(
		@GqlCurrentUser() user: CurrentUserDto,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
		limit: number,
		@Args('page', { type: () => Int, nullable: true }) page?: number,
		@Args('cursor', { type: () => String, nullable: true }) cursor?: string,
	): Promise<PaginatedCollectionResponseModel> {
		const result = await this.getUserCollectionsUseCase.execute(
			user.userId,
			limit,
			cursor,
			page,
		);

		const isPageDto = result instanceof PageDto;

		return {
			data: result.data.map((c) => c.toSnapshot()),
			nextCursor: isPageDto ? undefined : result.nextCursor || undefined,
			hasNextPage: isPageDto ? false : result.hasNextPage,
			total: isPageDto ? result.metadata.total : undefined,
			page: isPageDto ? result.metadata.page : undefined,
			lastPage: isPageDto ? result.metadata.lastPage : undefined,
		};
	}

	@ResolveField(() => [[CoverModel]], { name: 'bookCovers' })
	async getBookCovers(
		@Parent() collection: CollectionModel,
		@GqlCurrentUser() user: CurrentUserDto,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 4 })
		limit: number,
	) {
		const result = await this.getCollectionBookCoversUseCase.execute(
			user.userId,
			collection.id,
			limit,
		);
		return result.map((r) =>
			r.covers.map((cover) => ({
				id: cover.id,
				url: cover.url,
				isMain: cover.selected,
				metadata: cover.metadata,
			})),
		);
	}
}
