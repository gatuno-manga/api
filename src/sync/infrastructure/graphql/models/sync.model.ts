import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ChapterCommentModel } from '../../../../books/infrastructure/graphql/models/comment.model';

@ObjectType('ReadingProgressModel')
export class ReadingProgressModel {
	@Field(() => ID)
	bookId: string;

	@Field(() => ID)
	chapterId: string;

	@Field()
	pageIndex: number;

	@Field()
	updatedAt: Date;
}

@ObjectType('SyncResult')
export class SyncResultModel {
	@Field(() => [ReadingProgressModel])
	readingProgress: ReadingProgressModel[];

	@Field(() => [ID])
	savedPagesIds: string[];

	@Field(() => [ChapterCommentModel])
	comments: ChapterCommentModel[];

	@Field()
	syncedAt: Date;
}
