import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DashboardNameCountItemType {
	@Field()
	name: string;

	@Field(() => Int)
	count: number;
}
