import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsEnum,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
	IsUUID,
	MaxLength,
	ValidateIf,
} from 'class-validator';
import { ContentFormat } from '../enum/content-format.enum';

export class CreateChapterBatchItemDto {
	@ApiProperty({
		description: 'Book ID that will receive the chapter',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	bookId: string;

	@ApiPropertyOptional({
		description: 'Chapter title',
		example: 'Chapter 1: The Beginning',
		maxLength: 200,
	})
	@IsString()
	@IsOptional()
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({
		description: 'Optional chapter order index',
		example: 1,
		minimum: 1,
	})
	@IsNumber()
	@IsPositive()
	@IsOptional()
	index?: number;

	@ApiPropertyOptional({
		description: 'Optional source URL (ignored for manual creation)',
		example: 'https://example.com/book/chapter-1',
	})
	@IsUrl()
	@IsOptional()
	url?: string;

	@ApiPropertyOptional({
		description:
			'Optional chapter textual content. Must be provided together with format.',
		maxLength: 500000,
		example: '# Chapter 1\n\nOnce upon a time...',
	})
	@IsString()
	@IsNotEmpty({ message: 'O conteúdo não pode estar vazio' })
	@MaxLength(500000, { message: 'O conteúdo excede o limite de 500KB' })
	@ValidateIf((dto: CreateChapterBatchItemDto) => dto.format !== undefined)
	content?: string;

	@ApiPropertyOptional({
		description:
			'Optional textual format. Must be provided together with content.',
		enum: ContentFormat,
		example: ContentFormat.MARKDOWN,
	})
	@IsEnum(ContentFormat, {
		message: 'Formato deve ser: markdown, html ou plain',
	})
	@ValidateIf((dto: CreateChapterBatchItemDto) => dto.content !== undefined)
	format?: ContentFormat;
}
