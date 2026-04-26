import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('CommentUser')
export class CommentUserModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;
}

@ObjectType('ChapterComment')
export class ChapterCommentModel {
	@Field(() => ID)
	id: string;

	@Field()
	userName: string;

	@Field()
	content: string;

	@Field()
	isPublic: boolean;

	@Field()
	createdAt: Date;

	@Field(() => [ChapterCommentModel], { nullable: 'items' })
	replies: ChapterCommentModel[];
}
