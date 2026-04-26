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

	@Field(() => ID)
	userId: string;

	@Field()
	userName: string;

	@Field({ nullable: true })
	profileImageUrl?: string;

	@Field()
	content: string;

	@Field()
	isPublic: boolean;

	@Field()
	isDeleted: boolean;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;

	@Field(() => [ChapterCommentModel], { nullable: 'items' })
	replies: ChapterCommentModel[];
}
