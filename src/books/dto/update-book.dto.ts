import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsOptional,
	IsString,
	IsUrl,
	ValidateNested,
} from 'class-validator';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';
import { BookType } from '../enum/book-type.enum';
import { CreateAuthorDto } from './create-author.dto';
import { CreateBookDto } from './create-book.dto';

export class UpdateBookDto extends PartialType(
	OmitType(CreateBookDto, ['chapters', 'ignoreConflict'] as const),
) {
	@ApiPropertyOptional({
		description: 'Alternative titles for the book',
		example: ['ワンピース', 'Wan Pīsu'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[] = undefined;

	@ApiPropertyOptional({
		description: 'Type of book (Manga, Manhwa, Manhua, Book, or Other)',
		example: BookType.MANGA,
		enum: BookType,
	})
	@IsOptional()
	@IsEnum(BookType)
	type?: BookType;

	@ApiPropertyOptional({
		description: 'Array of sensitive content tags',
		example: ['violence', 'gore'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	sensitiveContent?: string[] = undefined;

	@ApiPropertyOptional({
		description: 'Original URLs where the book can be found',
		example: ['https://example.com/onepiece'],
		type: [String],
		isArray: true,
		format: 'url',
	})
	@IsOptional()
	@NormalizeUrl()
	@IsUrl({}, { each: true })
	originalUrl?: string[] = undefined;

	@ApiPropertyOptional({
		description: 'Array of tag names for the book',
		example: ['Action', 'Adventure', 'Shonen'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	tags?: string[] = undefined;

	@ApiPropertyOptional({
		description: 'Array of authors',
		type: [CreateAuthorDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateAuthorDto)
	authors?: CreateAuthorDto[] = undefined;
}
