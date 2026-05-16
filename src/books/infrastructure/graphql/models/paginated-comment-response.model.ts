import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ChapterCommentModel } from './comment.model';

@ObjectType('PaginatedCommentResponse')
export class PaginatedCommentResponseModel {
	@Field(() => [ChapterCommentModel])
	data: ChapterCommentModel[];

	@Field(() => Int, { nullable: true })
	total?: number;

	@Field(() => Int, { nullable: true })
	page?: number;

	@Field(() => Int, { nullable: true })
	lastPage?: number;

	@Field(() => String, { nullable: true })
	nextCursor?: string | null;

	@Field({ nullable: true })
	hasNextPage?: boolean;
}
