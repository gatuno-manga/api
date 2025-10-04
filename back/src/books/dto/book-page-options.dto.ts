import { PageOptionsDto } from 'src/pages/page-options.dto';
import { BookType } from '../enum/book-type.enum';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class BookPageOptionsDto extends PageOptionsDto {
	@ApiPropertyOptional({
		description: 'Filter by book types',
		example: [BookType.MANGA, BookType.MANHWA],
		enum: BookType,
		isArray: true,
		default: [BookType.OTHER, BookType.MANGA, BookType.MANHWA, BookType.MANHUA, BookType.BOOK],
	})
	@ApiPropertyOptional({
		description: 'Filter by book types',
		example: [BookType.MANGA, BookType.MANHWA],
		enum: BookType,
		isArray: true,
		default: [BookType.OTHER, BookType.MANGA, BookType.MANHWA, BookType.MANHUA, BookType.BOOK],
	})
	@IsOptional()
	@ToArray()
	type?: BookType[] = [
		BookType.OTHER,
		BookType.MANGA,
		BookType.MANHWA,
		BookType.MANHUA,
		BookType.BOOK,
	];

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
		example: 'and',
		enum: ['and', 'or'],
		default: 'and',
	})
	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	tagsLogic?: 'and' | 'or' = 'and';

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
		example: 'or',
		enum: ['and', 'or'],
		default: 'or',
	})
	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	excludeTagsLogic?: 'and' | 'or' = 'or';

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
		example: 'gte',
		enum: ['eq', 'gt', 'lt', 'gte', 'lte'],
		default: 'eq',
	})
	@IsOptional()
	@IsString()
	@IsIn(['eq', 'gt', 'lt', 'gte', 'lte'])
	publicationOperator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' = 'eq';

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
		example: 'and',
		enum: ['and', 'or'],
		default: 'and',
	})
	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	authorsLogic?: 'and' | 'or' = 'and';

	@ApiPropertyOptional({
		description: 'Field to order results by',
		example: 'createdAt',
		enum: ['title', 'createdAt', 'updatedAt', 'publication'],
		default: 'createdAt',
	})
	@IsOptional()
	@IsString()
	orderBy?: 'title' | 'createdAt' | 'updatedAt' | 'publication' = 'createdAt';

	@ApiPropertyOptional({
		description: 'Order direction (ascending or descending)',
		example: 'DESC',
		enum: ['ASC', 'DESC'],
	})
	@IsOptional()
	@IsString()
	order?: 'ASC' | 'DESC';
}
