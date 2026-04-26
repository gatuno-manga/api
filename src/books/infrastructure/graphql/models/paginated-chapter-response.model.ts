import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ChapterModel } from './chapter.model';

@ObjectType('PaginatedChapterResponse')
export class PaginatedChapterResponseModel {
	@Field(() => [ChapterModel])
	data: ChapterModel[];

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
