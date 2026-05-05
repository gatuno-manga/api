import {
	Args,
	ID,
	Int,
	Query,
	Resolver,
	ResolveField,
	Parent,
} from '@nestjs/graphql';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { BooksService } from '@books/application/services/books.service';
import { ChapterService } from '@books/application/services/chapter.service';
import { ChapterCommentsService } from '@books/application/services/chapter-comments.service';
import { AuthorsService } from '@books/application/services/authors.service';
import { TagsService } from '@books/application/services/tags.service';
import { BookDataLoaderService } from '@books/application/services/book-dataloader.service';
import {
	BookModel,
	CoverModel,
	AuthorModel,
	TagModel,
} from '@books/infrastructure/graphql/models/book.model';
import { ImageMetadataModel } from '@common/infrastructure/graphql/models/image-metadata.model';
import { ChapterModel } from '@books/infrastructure/graphql/models/chapter.model';
import { ChapterCommentModel } from '@books/infrastructure/graphql/models/comment.model';
import { PaginatedBookResponseModel } from '@books/infrastructure/graphql/models/paginated-book-response.model';
import { PaginatedCommentResponseModel } from '@books/infrastructure/graphql/models/paginated-comment-response.model';
import { PaginatedChapterResponseModel } from '@books/infrastructure/graphql/models/paginated-chapter-response.model';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { BookChaptersCursorOptionsDto } from '@books/application/dto/book-chapters-cursor-options.dto';
import { ChapterCommentsPageOptionsDto } from '@books/application/dto/chapter-comments-page-options.dto';
import { BookFilterInput } from '@books/infrastructure/graphql/models/book-filter.input';
import { ChapterFilterInput } from '@books/infrastructure/graphql/models/chapter-filter.input';
import { GqlCurrentUser } from 'src/auth/infrastructure/framework/gql-current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { OptionalGqlJwtAuthGuard } from 'src/auth/infrastructure/framework/optional-gql-jwt-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { PageDto } from 'src/common/pagination/page.dto';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';

@Resolver(() => BookModel)
export class BookResolver {
	constructor(
		private readonly booksService: BooksService,
		private readonly chapterService: ChapterService,
		private readonly chapterCommentsService: ChapterCommentsService,
		private readonly authorsService: AuthorsService,
		private readonly tagsService: TagsService,
		private readonly dataLoaderService: BookDataLoaderService,
	) {}

	@Query(() => [AuthorModel], { name: 'searchAuthors' })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(60)
	async searchAuthors(@Args('query') query: string) {
		return this.authorsService.search(query);
	}

	@Query(() => [TagModel], { name: 'searchTags' })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(60)
	async searchTags(@Args('query') query: string) {
		return this.tagsService.search(query);
	}

	@Query(() => PaginatedBookResponseModel, { name: 'books' })
	@UseGuards(OptionalGqlJwtAuthGuard)
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(180)
	async getBooks(
		@Args('filter', { type: () => BookFilterInput, nullable: true })
		filter?: BookFilterInput,
		@GqlCurrentUser() user?: CurrentUserDto,
	): Promise<PaginatedBookResponseModel> {
		const options = new BookPageOptionsDto();

		if (filter) {
			Object.assign(options, filter);
			options.page = filter.page ?? 1;
			options.search = filter.search;
			Object.assign(options, { limit: filter.limit ?? 20 });
		}

		const result = await this.booksService.getAllBooks(
			options,
			user?.maxWeightSensitiveContent ?? 0,
			user?.userId,
		);

		const mappedData = result.data.map((book) => ({
			...book,
			// Relations handled by @ResolveField or DataLoaders
		})) as BookModel[];

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

	@Query(() => BookModel, { name: 'book', nullable: true })
	@UseGuards(OptionalGqlJwtAuthGuard)
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(300)
	async getBook(
		@Args('id', { type: () => ID }) id: string,
		@GqlCurrentUser() user?: CurrentUserDto,
	) {
		const book = await this.booksService.getOne(
			id,
			user?.maxWeightSensitiveContent ?? 0,
			user?.userId,
		);

		if (!book) return null;

		return {
			...book,
		};
	}

	@ResolveField(() => [AuthorModel], { name: 'authors' })
	async getBookAuthors(@Parent() book: BookModel): Promise<AuthorModel[]> {
		const authors = await this.dataLoaderService.authorsLoader.load(
			book.id,
		);
		return authors as AuthorModel[];
	}

	@ResolveField(() => [TagModel], { name: 'tags' })
	async getBookTags(@Parent() book: BookModel): Promise<TagModel[]> {
		const tags = await this.dataLoaderService.tagsLoader.load(book.id);
		return tags as TagModel[];
	}

	@ResolveField(() => PaginatedChapterResponseModel, { name: 'chapters' })
	async getBookChapters(
		@Parent() book: BookModel,
		@Args('filter', { type: () => ChapterFilterInput, nullable: true })
		filter?: ChapterFilterInput,
		@GqlCurrentUser() user?: CurrentUserDto,
	): Promise<PaginatedChapterResponseModel> {
		// Se não houver filtro, usamos o DataLoader para performance em massa
		if (!filter) {
			const chapters = await this.dataLoaderService.chaptersLoader.load(
				book.id,
			);
			return {
				data: chapters as unknown as ChapterModel[],
				hasNextPage: false,
			};
		}

		// Se houver filtro (ex: paginação por cursor), usamos o serviço tradicional
		const options = new BookChaptersCursorOptionsDto();
		options.cursor = filter.cursor;
		options.order = filter.order;
		Object.assign(options, { limit: filter.limit ?? 100 });

		const result = await this.booksService.getChapters(
			book.id,
			options,
			user?.userId,
			user?.maxWeightSensitiveContent ?? 0,
		);

		return {
			data: result.data as ChapterModel[],
			nextCursor: result.nextCursor,
			hasNextPage: result.hasNextPage,
		};
	}

	@ResolveField(() => [CoverModel], { name: 'covers' })
	async getBookCovers(@Parent() book: BookModel): Promise<CoverModel[]> {
		const covers = await this.dataLoaderService.coversLoader.load(book.id);

		return (covers || []).map((cover) => ({
			id: cover.id,
			url: cover.url,
			isMain: cover.selected,
			metadata: cover.metadata as ImageMetadataModel,
		}));
	}

	@Query(() => ChapterModel, { name: 'chapter', nullable: true })
	@UseGuards(OptionalGqlJwtAuthGuard)
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(600)
	async getChapter(
		@Args('id', { type: () => ID }) id: string,
		@GqlCurrentUser() user?: CurrentUserDto,
	) {
		return this.chapterService.getChapter(id, user?.userId);
	}

	@Query(() => PaginatedCommentResponseModel, { name: 'bookComments' })
	@UseGuards(OptionalGqlJwtAuthGuard)
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(120)
	async getBookComments(
		@Args('chapterId', { type: () => ID }) chapterId: string,
		@Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
		page: number,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
		limit: number,
		@GqlCurrentUser() user?: CurrentUserDto,
	): Promise<PaginatedCommentResponseModel> {
		const options = new ChapterCommentsPageOptionsDto();
		options.page = page;
		Object.assign(options, { limit });

		const result = await this.chapterCommentsService.listChapterComments(
			chapterId,
			options,
			user,
		);

		const metadata =
			result instanceof PageDto ? result.metadata : undefined;
		const cursorPage = result instanceof CursorPageDto ? result : undefined;

		return {
			data: result.data as ChapterCommentModel[],
			total: metadata?.total,
			page: metadata?.page,
			lastPage: metadata?.lastPage,
			nextCursor: cursorPage?.nextCursor,
			hasNextPage: cursorPage?.hasNextPage,
		};
	}
}
