import { Field, Int, ObjectType } from '@nestjs/graphql';
import { UserModel } from './user.model';

@ObjectType('PaginatedUserResponse')
export class PaginatedUserResponseModel {
	@Field(() => [UserModel])
	data: UserModel[];

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
