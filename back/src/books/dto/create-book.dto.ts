import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsEnum,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
	Max,
	Min,
	ValidateNested,
} from 'class-validator';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';
import { BookType } from '../enum/book-type.enum';
import { CoverBookDto } from './cover-book.dto';
import { CreateAuthorDto } from './create-author.dto';
import { CreateChapterDto } from './create-chapter.dto';
import { transformCoverBookLegacyFormat } from './transformers/cover-book.transformer';

export class CreateBookDto {
	@ApiProperty({
		description: 'Book title',
		example: 'One Piece',
		maxLength: 300,
	})
	@IsString()
	title: string;

	@ApiPropertyOptional({
		description: 'Alternative titles for the book',
		example: ['ワンピース', 'Wan Pīsu'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[] = [];

	@ApiPropertyOptional({
		description: 'Type of book (Manga, Manhwa, Manhua, Book, or Other)',
		example: BookType.MANGA,
		enum: BookType,
		default: BookType.OTHER,
	})
	@IsOptional()
	@IsEnum(BookType)
	type?: BookType = BookType.OTHER;

	@ApiPropertyOptional({
		description: 'Array of sensitive content tags',
		example: ['violence', 'gore'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	sensitiveContent?: string[] = [];

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
	originalUrl?: string[] = [];

	@ApiPropertyOptional({
		description: 'Book description or synopsis',
		example:
			'A story about a young pirate who dreams of becoming the Pirate King',
		maxLength: 5000,
	})
	@IsOptional()
	@IsString()
	description?: string;

	@ApiPropertyOptional({
		description: 'Book cover information',
		type: CoverBookDto,
	})
	@Transform(transformCoverBookLegacyFormat)
	@IsOptional()
	@ValidateNested()
	@Type(() => CoverBookDto)
	cover?: CoverBookDto;

	@ApiPropertyOptional({
		description: 'Year of publication',
		example: 1997,
		minimum: 1980,
		maximum: new Date().getFullYear() + 2,
	})
	@IsOptional()
	@IsNumber()
	@IsPositive()
	@Min(1980)
	@Max(new Date().getFullYear() + 2)
	publication?: number;

	@ApiPropertyOptional({
		description: 'Array of tag names for the book',
		example: ['Action', 'Adventure', 'Shonen'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	tags?: string[] = [];

	@ApiPropertyOptional({
		description: 'Array of authors',
		type: [CreateAuthorDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateAuthorDto)
	authors?: CreateAuthorDto[] = [];

	@ApiPropertyOptional({
		description: 'Array of chapters',
		type: [CreateChapterDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateChapterDto)
	chapters?: CreateChapterDto[] = [];

	@ApiPropertyOptional({
		description:
			'Validates if the book can be created even if there is a title conflict. ' +
			'If false (default), the book will not be created if another book with the same title or alternative title exists. ' +
			'If true, allows creating the book even with a title conflict.',
		example: false,
		default: false,
	})
	@IsOptional()
	ignoreConflict = false;
}
