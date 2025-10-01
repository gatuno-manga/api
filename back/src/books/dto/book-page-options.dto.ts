import { PageOptionsDto } from 'src/pages/page-options.dto';
import { BookType } from '../enum/book-type.enum';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class BookPageOptionsDto extends PageOptionsDto {
	@IsOptional()
	@ToArray()
	type?: BookType[] = [
		BookType.OTHER,
		BookType.MANGA,
		BookType.MANHWA,
		BookType.MANHUA,
		BookType.BOOK,
	];

	@IsOptional()
	@ToArray()
	sensitiveContent?: string[] = [];

	@IsOptional()
	@IsString()
	search?: string;

	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	tags?: string[] = [];

	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	tagsLogic?: 'and' | 'or' = 'and';

	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	excludeTags?: string[] = [];

	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	excludeTagsLogic?: 'and' | 'or' = 'or';

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@IsPositive()
	publication?: number;

	@IsOptional()
	@IsString()
	@IsIn(['eq', 'gt', 'lt', 'gte', 'lte'])
	publicationOperator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' = 'eq';

	@IsOptional()
	@ToArray()
	@IsUUID('4', { each: true })
	authors?: string[] = [];

	@IsOptional()
	@IsString()
	@IsIn(['and', 'or'])
	authorsLogic?: 'and' | 'or' = 'and';

	@IsOptional()
	@IsString()
	orderBy?: 'title' | 'createdAt' | 'updatedAt' | 'publication' = 'createdAt';

	@IsOptional()
	@IsString()
	order?: 'ASC' | 'DESC';
}
