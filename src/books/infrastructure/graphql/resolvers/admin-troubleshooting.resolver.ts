import { AdminBookPageOptionsDto } from '@books/application/dto/admin-book-page-options.dto';
import { BooksService } from '@books/application/services/books.service';
import { AdminBookFilterInput } from '@books/infrastructure/graphql/models/admin-book-filter.input';
import { BookModel } from '@books/infrastructure/graphql/models/book.model';
import { PaginatedBookResponseModel } from '@books/infrastructure/graphql/models/paginated-book-response.model';
import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';

@Resolver(() => BookModel)
@UseGuards(GqlJwtAuthGuard)
@Roles(RolesEnum.ADMIN)
export class AdminTroubleshootingResolver {
	constructor(private readonly booksService: BooksService) {}

	@Query(() => PaginatedBookResponseModel, { name: 'adminBooksWithErrors' })
	async getAdminBooksWithErrors(
		@Args('filter', { type: () => AdminBookFilterInput, nullable: true })
		filter?: AdminBookFilterInput,
	): Promise<PaginatedBookResponseModel> {
		const options = new AdminBookPageOptionsDto();

		if (filter) {
			Object.assign(options, filter);
			options.page = filter.page ?? 1;
			options.search = filter.search;
			Object.assign(options, { limit: filter.limit ?? 20 });
			options.scrapingStatus = filter.scrapingStatus;
		}

		// As admin, bypass sensitive content user weights
		const result = await this.booksService.getAllBooks(
			options,
			0,
			undefined,
			undefined,
		);

		const mappedData = result.data.map((book) => ({
			...book,
		})) as unknown as BookModel[];

		const metadata =
			result instanceof PageDto ? result.metadata : undefined;
		const cursorPage = result instanceof CursorPageDto ? result : undefined;

		return {
			data: mappedData,
			total: metadata?.total,
			page: metadata?.page,
			lastPage: metadata?.lastPage,
			nextCursor: cursorPage?.nextCursor,
			hasNextPage: cursorPage?.hasNextPage,
		};
	}
}
