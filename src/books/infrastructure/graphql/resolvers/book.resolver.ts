import { BookChaptersCursorOptionsDto } from '@books/application/dto/book-chapters-cursor-options.dto';
import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { ChapterCommentsPageOptionsDto } from '@books/application/dto/chapter-comments-page-options.dto';
import { AuthorsService } from '@books/application/services/authors.service';
import { BookDataLoaderService } from '@books/application/services/book-dataloader.service';
import { BooksService } from '@books/application/services/books.service';
import { ChapterCommentsService } from '@books/application/services/chapter-comments.service';
import { ChapterService } from '@books/application/services/chapter.service';
import { TagsService } from '@books/application/services/tags.service';
import { resolveLocalizedField } from '@books/application/utils/localization.utils';
import { AuthorBiography } from '@books/domain/entities/author-biography';
import { BookFilterInput } from '@books/infrastructure/graphql/models/book-filter.input';
import {
	AuthorModel,
	BookModel,
	CoverModel,
	TagModel,
} from '@books/infrastructure/graphql/models/book.model';
import { ChapterFilterInput } from '@books/infrastructure/graphql/models/chapter-filter.input';
import { ChapterModel } from '@books/infrastructure/graphql/models/chapter.model';
import { ChapterCommentModel } from '@books/infrastructure/graphql/models/comment.model';
import { PaginatedBookResponseModel } from '@books/infrastructure/graphql/models/paginated-book-response.model';
import { PaginatedChapterResponseModel } from '@books/infrastructure/graphql/models/paginated-chapter-response.model';
import { PaginatedCommentResponseModel } from '@books/infrastructure/graphql/models/paginated-comment-response.model';
import { StorageBucket } from '@common/enum/storage-bucket.enum';
import { ImageMetadataModel } from '@common/infrastructure/graphql/models/image-metadata.model';
import { CacheTTL } from '@nestjs/cache-manager';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import {
	Args,
	ID,
	Int,
	Parent,
	Query,
	ResolveField,
	Resolver,
} from '@nestjs/graphql';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { GqlCurrentUser } from 'src/auth/infrastructure/framework/gql-current-user.decorator';
import { OptionalGqlJwtAuthGuard } from 'src/auth/infrastructure/framework/optional-gql-jwt-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { CursorPageDto } from 'src/common/pagination/cursor-page.dto';
import { PageDto } from 'src/common/pagination/page.dto';
import { MediaUrlService } from 'src/common/services/media-url.service';

@Resolver(() => BookModel)
export class BookResolver {
	constructor(
		private readonly booksService: BooksService,
		private readonly chapterService: ChapterService,
		private readonly chapterCommentsService: ChapterCommentsService,
		private readonly authorsService: AuthorsService,
		private readonly tagsService: TagsService,
		private readonly dataLoaderService: BookDataLoaderService,
		private readonly mediaUrlService: MediaUrlService,
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

		const targetLang = filter?.lang || user?.preferredLanguage;

		const result = await this.booksService.getAllBooks(
			options,
			user?.maxWeightSensitiveContent ?? 0,
			user?.userId,
			targetLang,
		);

		const mappedData = result.data.map((book) => ({
			...book,
			// Relations handled by @ResolveField or DataLoaders
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

	@Query(() => BookModel, { name: 'book', nullable: true })
	@UseGuards(OptionalGqlJwtAuthGuard)
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(300)
	async getBook(
		@Args('id', { type: () => ID }) id: string,
		@Args('lang', { type: () => String, nullable: true }) lang?: string,
		@GqlCurrentUser() user?: CurrentUserDto,
	) {
		const targetLang = lang || user?.preferredLanguage;
		const book = await this.booksService.getOne(
			id,
			user?.maxWeightSensitiveContent ?? 0,
			user?.userId,
			false,
			targetLang,
		);

		if (!book) return null;

		return {
			...book,
		};
	}

	@ResolveField(() => [AuthorModel], { name: 'authors' })
	async getBookAuthors(
		@Parent() book: BookModel,
		@Args('lang', { type: () => String, nullable: true }) lang?: string,
		@GqlCurrentUser() user?: CurrentUserDto,
	): Promise<AuthorModel[]> {
		const authors = await this.dataLoaderService.authorsLoader.load(
			book.id,
		);

		const targetLang = lang || user?.preferredLanguage;

		// Note: Since DataLoader might share results, we need to map them here
		return authors.map((author) => {
			const bestBio = resolveLocalizedField(
				author.localizedBiographies,
				targetLang,
				null,
				'pt-BR',
				(item: AuthorBiography) => item.biography,
			);
			return {
				...author,
				biography: bestBio?.biography || author.biography,
			};
		}) as AuthorModel[];
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

			const availableLanguages = Array.from(
				new Set(chapters.map((ch) => ch.languageCode).filter(Boolean)),
			) as string[];

			return {
				data: chapters as ChapterModel[],
				hasNextPage: false,
				availableLanguages,
			};
		}

		// Se houver filtro (ex: paginação por cursor), usamos o serviço tradicional
		const options = new BookChaptersCursorOptionsDto();
		options.cursor = filter.cursor;
		options.order = filter.order;
		options.languageCode = filter.languageCode;
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
			availableLanguages: result.availableLanguages,
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

	@ResolveField(() => String, { name: 'cover', nullable: true })
	getBookCover(@Parent() book: BookModel): Promise<string | null> {
		if (!book.cover) return Promise.resolve(null);
		return Promise.resolve(
			this.mediaUrlService.resolveUrl(book.cover, StorageBucket.BOOKS),
		);
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
