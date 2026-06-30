import { NormalizeUrl } from '@common/decorators/normalize-url.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
	MaxLength,
} from 'class-validator';

export class CreateChapterDto {
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
		description: 'URL of the chapter source (optional for manual upload)',
		example: 'https://example.com/book/chapter-1',
		format: 'url',
	})
	@NormalizeUrl()
	@IsUrl()
	@IsOptional()
	url?: string;

	@ApiPropertyOptional({
		description: 'Chapter order index',
		example: 1,
		minimum: 1,
	})
	@Type(() => Number)
	@IsNumber()
	@IsPositive()
	@IsOptional()
	index?: number;

	@ApiPropertyOptional({
		description: 'Indicates if this is the final chapter of the book',
		example: false,
	})
	@IsOptional()
	isFinal?: boolean;

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

	@ApiPropertyOptional({
		description: 'Language code for the chapter (e.g. pt-BR, en)',
		example: 'pt-BR',
	})
	@IsString()
	@IsOptional()
	languageCode?: string;
}
