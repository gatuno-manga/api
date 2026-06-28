import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DashboardCountsType {
	@Field(() => Int)
	books: number;

	@Field(() => Int)
	chapters: number;

	@Field(() => Int)
	users: number;

	@Field(() => Int)
	pages: number;

	@Field(() => Int)
	tags: number;

	@Field(() => Int)
	authors: number;

	@Field(() => Int)
	sensitiveContent: number;
}
