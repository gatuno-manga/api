import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { OrderDirection } from '../../../../common/enum/order-direction.enum';

@InputType('ChapterFilterInput')
export class ChapterFilterInput {
	@Field(() => Int, { nullable: true, defaultValue: 1 })
	@IsOptional()
	@IsInt()
	@IsPositive()
	page?: number;

	@Field(() => Int, { nullable: true, defaultValue: 100 })
	@IsOptional()
	@IsInt()
	@Min(1)
	limit?: number;

	@Field({ nullable: true })
	@IsOptional()
	@IsString()
	cursor?: string;

	@Field(() => OrderDirection, {
		nullable: true,
		defaultValue: OrderDirection.ASC,
	})
	@IsOptional()
	order?: OrderDirection;
}
