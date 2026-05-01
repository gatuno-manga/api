import { Field, ID, InputType, Int, registerEnumType } from '@nestjs/graphql';
import {
	IsArray,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUUID,
} from 'class-validator';
import { FilterLogic } from '../../../../common/enum/filter-logic.enum';
import { FilterOperator } from '../../../../common/enum/filter-operator.enum';
import { OrderDirection } from '../../../../common/enum/order-direction.enum';
import { BookOrderField } from '../../../domain/enums/book-order-field.enum';
import { BookType } from '../../../domain/enums/book-type.enum';

registerEnumType(FilterLogic, { name: 'FilterLogic' });
registerEnumType(FilterOperator, { name: 'FilterOperator' });
registerEnumType(OrderDirection, { name: 'OrderDirection' });
registerEnumType(BookOrderField, { name: 'BookOrderField' });

@InputType('BookFilterInput')
export class BookFilterInput {
	@Field(() => Int, { nullable: true, defaultValue: 1 })
	@IsOptional()
	@IsInt()
	@IsPositive()
	page?: number;

	@Field(() => Int, { nullable: true, defaultValue: 20 })
	@IsOptional()
	@IsInt()
	@IsPositive()
	limit?: number;

	@Field({ nullable: true })
	@IsOptional()
	@IsString()
	cursor?: string;

	@Field(() => [BookType], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsEnum(BookType, { each: true })
	type?: BookType[];

	@Field(() => [String], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	sensitiveContent?: string[];

	@Field({ nullable: true })
	@IsOptional()
	@IsString()
	search?: string;

	@Field(() => [ID], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	tags?: string[];

	@Field(() => FilterLogic, { nullable: true, defaultValue: FilterLogic.AND })
	@IsOptional()
	@IsEnum(FilterLogic)
	tagsLogic?: FilterLogic;

	@Field(() => [ID], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	excludeTags?: string[];

	@Field(() => FilterLogic, { nullable: true, defaultValue: FilterLogic.OR })
	@IsOptional()
	@IsEnum(FilterLogic)
	excludeTagsLogic?: FilterLogic;

	@Field(() => Int, { nullable: true })
	@IsOptional()
	@IsNumber()
	publication?: number;

	@Field(() => FilterOperator, {
		nullable: true,
		defaultValue: FilterOperator.EQ,
	})
	@IsOptional()
	@IsEnum(FilterOperator)
	publicationOperator?: FilterOperator;

	@Field(() => [ID], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	authors?: string[];

	@Field(() => FilterLogic, { nullable: true, defaultValue: FilterLogic.AND })
	@IsOptional()
	@IsEnum(FilterLogic)
	authorsLogic?: FilterLogic;

	@Field(() => [String], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	sites?: string[];

	@Field(() => BookOrderField, {
		nullable: true,
		defaultValue: BookOrderField.CREATED_AT,
	})
	@IsOptional()
	@IsEnum(BookOrderField)
	orderBy?: BookOrderField;

	@Field(() => OrderDirection, {
		nullable: true,
		defaultValue: OrderDirection.DESC,
	})
	@IsOptional()
	@IsEnum(OrderDirection)
	order?: OrderDirection;
}
