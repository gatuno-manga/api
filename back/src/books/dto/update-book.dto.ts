import { CreateBookDto } from './create-book.dto';
import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
	IsOptional,
	IsString,
	ValidateNested,
	IsEnum,
	IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookType } from '../enum/book-type.enum';
import { CreateAuthorDto } from './create-author.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';

export class UpdateBookDto extends PartialType(
	OmitType(CreateBookDto, ['chapters', 'validator'] as const),
) {
	@ApiPropertyOptional({
		description: 'Alternative titles for the book',
		example: ['ワンピース', 'Wan Pīsu'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[];

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
	sensitiveContent?: string[];

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
	originalUrl?: string[];

	@ApiPropertyOptional({
		description: 'Array of tag names for the book',
		example: ['Action', 'Adventure', 'Shonen'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	tags?: string[];

	@ApiPropertyOptional({
		description: 'Array of authors',
		type: [CreateAuthorDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateAuthorDto)
	authors?: CreateAuthorDto[];
}
