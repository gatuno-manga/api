import { BookType } from '@books/domain/enums/book-type.enum';
import { NormalizeUrl } from '@common/decorators/normalize-url.decorator';
import { SUPPORTED_LANGUAGE_CODES } from '@common/domain/constants/languages.constant';
import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsIn,
	IsOptional,
	IsString,
	IsUrl,
	ValidateNested,
} from 'class-validator';
import { AlternativeTitleDto } from './alternative-title.dto';
import { CreateAuthorDto } from './create-author.dto';
import { CreateBookDto } from './create-book.dto';
import { LocalizedDescriptionDto } from './localized-description.dto';

export class UpdateBookDto extends PartialType(
	OmitType(CreateBookDto, ['chapters', 'ignoreConflict'] as const),
) {
	@ApiPropertyOptional({
		description: 'Alternative titles for the book',
		type: [AlternativeTitleDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => AlternativeTitleDto)
	alternativeTitles?: AlternativeTitleDto[] = undefined;

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
		enum: SUPPORTED_LANGUAGE_CODES,
	})
	@IsOptional()
	@IsString()
	@IsIn(SUPPORTED_LANGUAGE_CODES)
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
	searchTerms?: string[] = undefined;

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
