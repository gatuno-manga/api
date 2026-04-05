import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUUID,
} from 'class-validator';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { PageOptionsDto } from 'src/pages/page-options.dto';
import { FilterLogic } from 'src/common/enum/filter-logic.enum';
import { FilterOperator } from 'src/common/enum/filter-operator.enum';
import { OrderDirection } from 'src/common/enum/order-direction.enum';
import { BookOrderField } from '../enum/book-order-field.enum';
import { BookType } from '../enum/book-type.enum';

export class BookPageOptionsDto extends PageOptionsDto {
	@ApiPropertyOptional({
		description: 'Filter by book types',
		example: [BookType.MANGA, BookType.MANHWA],
		enum: BookType,
		isArray: true,
		default: Object.values(BookType),
	})
	@IsOptional()
	@ToArray()
	type?: BookType[] = Object.values(BookType);

	@ApiPropertyOptional({
		description: 'Filter by sensitive content tags',
		example: ['violence', 'gore'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	sensitiveContent?: string[] = [];

	@ApiPropertyOptional({
		description: 'Search text in book title and description',
		example: 'one piece',
	})
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({
		description: 'Filter by tag IDs',
		example: ['550e8400-e29b-41d4-a716-446655440000'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	tags?: string[] = [];

	@ApiPropertyOptional({
		description: 'Logical operator for tags filter (and/or)',
		example: FilterLogic.AND,
		enum: FilterLogic,
		default: FilterLogic.AND,
	})
	@IsOptional()
	@IsEnum(FilterLogic)
	tagsLogic?: FilterLogic = FilterLogic.AND;

	@ApiPropertyOptional({
		description: 'Exclude books with these tag IDs',
		example: ['6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	excludeTags?: string[] = [];

	@ApiPropertyOptional({
		description: 'Logical operator for exclude tags filter (and/or)',
		example: FilterLogic.OR,
		enum: FilterLogic,
		default: FilterLogic.OR,
	})
	@IsOptional()
	@IsEnum(FilterLogic)
	excludeTagsLogic?: FilterLogic = FilterLogic.OR;

	@ApiPropertyOptional({
		description: 'Filter by publication year',
		example: 1997,
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@IsPositive()
	publication?: number;

	@ApiPropertyOptional({
		description: 'Comparison operator for publication year',
		example: FilterOperator.GTE,
		enum: FilterOperator,
		default: FilterOperator.EQ,
	})
	@IsOptional()
	@IsEnum(FilterOperator)
	publicationOperator?: FilterOperator = FilterOperator.EQ;

	@ApiPropertyOptional({
		description: 'Filter by author IDs',
		example: ['550e8400-e29b-41d4-a716-446655440000'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	authors?: string[] = [];

	@ApiPropertyOptional({
		description: 'Logical operator for authors filter (and/or)',
		example: FilterLogic.AND,
		enum: FilterLogic,
		default: FilterLogic.AND,
	})
	@IsOptional()
	@IsEnum(FilterLogic)
	authorsLogic?: FilterLogic = FilterLogic.AND;

	@ApiPropertyOptional({
		description: 'Field to order results by',
		example: BookOrderField.CREATED_AT,
		enum: BookOrderField,
		default: BookOrderField.CREATED_AT,
	})
	@IsOptional()
	@IsEnum(BookOrderField)
	orderBy?: BookOrderField = BookOrderField.CREATED_AT;

	@ApiPropertyOptional({
		description: 'Order direction (ascending or descending)',
		example: OrderDirection.DESC,
		enum: OrderDirection,
	})
	@IsOptional()
	@IsEnum(OrderDirection)
	order?: OrderDirection;
}
