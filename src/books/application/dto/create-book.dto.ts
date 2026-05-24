import { BookType } from '@books/domain/enums/book-type.enum';
import { NormalizeUrl } from '@common/decorators/normalize-url.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';
import { AlternativeTitleDto } from './alternative-title.dto';
import { CoverBookDto } from './cover-book.dto';
import { CreateAuthorDto } from './create-author.dto';
import { CreateChapterDto } from './create-chapter.dto';
import { LocalizedDescriptionDto } from './localized-description.dto';
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
		type: [AlternativeTitleDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => AlternativeTitleDto)
	alternativeTitles?: AlternativeTitleDto[];

	@ApiPropertyOptional({
		description: 'Legacy field for alternative titles (string array)',
		example: ['ワンピース', 'Wan Pīsu'],
		type: [String],
		isArray: true,
		deprecated: true,
	})
	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[];

	@ApiPropertyOptional({
		description: 'Original language code (BCP 47)',
		example: 'ja-JP',
		maxLength: 10,
	})
	@IsOptional()
	@IsString()
	@MaxLength(10)
	originalLanguageCode?: string;

	@ApiPropertyOptional({
		description: 'Localized descriptions for the book',
		type: [LocalizedDescriptionDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => LocalizedDescriptionDto)
	localizedDescriptions?: LocalizedDescriptionDto[];

	@ApiPropertyOptional({
		description:
			'Custom search terms or synonyms (e.g., "hxh" for Hunter x Hunter)',
		example: ['hxh', 'h x h'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	searchTerms?: string[] = [];

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
		description:
			'Book description or synopsis (Legacy - will be mapped to localizedDescriptions)',
		example:
			'A story about a young pirate who dreams of becoming the Pirate King',
		maxLength: 5000,
		deprecated: true,
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
		type: Boolean,
	})
	@IsOptional()
	@IsBoolean()
	ignoreConflict = false;
}
