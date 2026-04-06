import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsPositive,
	IsString,
	MaxLength,
	ValidateIf,
} from 'class-validator';
import { ContentFormat } from '../enum/content-format.enum';

export class CreateChapterManualDto {
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
		description: 'Chapter order index',
		example: 1,
		minimum: 0,
	})
	@Type(() => Number)
	@IsInt()
	@IsPositive()
	@IsOptional()
	index?: number;

	@ApiPropertyOptional({
		description:
			'Optional chapter textual content. Must be provided together with format.',
		maxLength: 500000,
		example: '# Chapter 1\n\nOnce upon a time...',
	})
	@IsString()
	@IsNotEmpty({ message: 'O conteúdo não pode estar vazio' })
	@MaxLength(500000, { message: 'O conteúdo excede o limite de 500KB' })
	@ValidateIf((dto: CreateChapterManualDto) => dto.format !== undefined)
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
	@ValidateIf((dto: CreateChapterManualDto) => dto.content !== undefined)
	format?: ContentFormat;
}
