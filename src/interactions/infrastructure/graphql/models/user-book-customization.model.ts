import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('UserBookCustomization')
export class UserBookCustomizationModel {
	@Field(() => ID)
	userId: string;

	@Field(() => ID)
	bookId: string;

	@Field(() => String, { nullable: true })
	customTitle: string | null;

	@Field(() => String, { nullable: true })
	customCoverUrl: string | null;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}
