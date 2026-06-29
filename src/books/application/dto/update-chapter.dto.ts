import { ContentFormat } from '@books/domain/enums/content-format.enum';
import { NormalizeUrl } from '@common/decorators/normalize-url.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
	MaxLength,
	ValidateIf,
} from 'class-validator';

export class UpdateChapterDto {
	@ApiPropertyOptional({
		description: 'Chapter title',
		example: 'Chapter 1: The Beginning',
		maxLength: 200,
	})
	@IsString()
	@MaxLength(200)
	@IsOptional()
	title?: string;

	@ApiPropertyOptional({
		description: 'URL of the chapter source',
		example: 'https://example.com/book/chapter-1',
		format: 'url',
	})
	@NormalizeUrl()
	@IsUrl()
	@IsOptional()
	url?: string;

	@ApiProperty({
		description: 'Chapter order index',
		example: 1,
		minimum: 1,
	})
	@Type(() => Number)
	@IsNumber()
	@IsPositive()
	index: number;

	@ApiPropertyOptional({
		description: 'Optional chapter textual content',
		maxLength: 500000,
	})
	@IsString()
	@IsOptional()
	@IsNotEmpty()
	content?: string;

	@ApiPropertyOptional({
		description: 'Optional textual format',
		enum: ContentFormat,
	})
	@IsEnum(ContentFormat)
	@IsOptional()
	@ValidateIf((dto: UpdateChapterDto) => dto.content !== undefined)
	format?: ContentFormat;

	@ApiPropertyOptional({
		description:
			'Specific CSS selector for this chapter to override website defaults',
		example: 'div#capitulo-5 img',
		maxLength: 255,
	})
	@IsString()
	@MaxLength(255)
	@IsOptional()
	specificSelector?: string;
}
