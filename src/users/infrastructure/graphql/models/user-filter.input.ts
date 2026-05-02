import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('UserFilter')
export class UserFilterInput {
	@Field(() => Int, { nullable: true, defaultValue: 1 })
	page?: number;

	@Field(() => Int, { nullable: true, defaultValue: 20 })
	limit?: number;

	@Field({ nullable: true })
	cursor?: string;

	@Field({ nullable: true })
	search?: string;

	@Field({ nullable: true })
	role?: string;

	@Field({ nullable: true })
	isBanned?: boolean;

	@Field({ nullable: true })
	isSuspended?: boolean;
}
