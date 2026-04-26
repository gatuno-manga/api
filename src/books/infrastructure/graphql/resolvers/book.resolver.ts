import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { BookQueryService } from '../../../application/services/book-query.service';
import { ChapterCommentsService } from '../../../application/services/chapter-comments.service';
import { BookModel } from '../models/book.model';
import { ChapterCommentModel } from '../models/comment.model';
import { BookPageOptionsDto } from '../../../application/dto/book-page-options.dto';
import { ChapterCommentsPageOptionsDto } from '../../../application/dto/chapter-comments-page-options.dto';

@Resolver(() => BookModel)
export class BookResolver {
	constructor(
		private readonly bookQueryService: BookQueryService,
		private readonly chapterCommentsService: ChapterCommentsService,
	) {}

	@Query(() => [BookModel], { name: 'books' })
	async getBooks(
		@Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
		page: number,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
		limit: number,
		@Args('search', { type: () => String, nullable: true }) search?: string,
	) {
		const options = new BookPageOptionsDto();
		options.page = page;
		options.search = search;
		Object.assign(options, { limit });

		const result = await this.bookQueryService.getAllBooks(
			options,
			0,
			undefined,
			[],
		);

		return result.data;
	}

	@Query(() => BookModel, { name: 'book' })
	async getBook(@Args('id', { type: () => ID }) id: string) {
		return this.bookQueryService.getOne(id);
	}

	@Query(() => [ChapterCommentModel], { name: 'bookComments' })
	async getBookComments(
		@Args('chapterId', { type: () => ID }) chapterId: string,
		@Args('page', { type: () => Int, nullable: true, defaultValue: 1 })
		page: number,
		@Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
		limit: number,
	) {
		const options = new ChapterCommentsPageOptionsDto();
		options.page = page;
		Object.assign(options, { limit });

		const result = await this.chapterCommentsService.listChapterComments(
			chapterId,
			options,
		);

		return result.data;
	}
}
