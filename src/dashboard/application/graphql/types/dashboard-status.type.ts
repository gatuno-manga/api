import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DashboardStatusItemType {
	@Field()
	status: string;

	@Field(() => Int)
	count: number;
}

@ObjectType()
export class DashboardStatusType {
	@Field(() => [DashboardStatusItemType])
	books: DashboardStatusItemType[];

	@Field(() => [DashboardStatusItemType])
	chapters: DashboardStatusItemType[];
}
