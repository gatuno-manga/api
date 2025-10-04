import {
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChapterDto {
	@ApiPropertyOptional({
		description: 'Chapter title',
		example: 'Chapter 1: The Beginning',
		maxLength: 200,
	})
	@IsString()
	@IsOptional()
	title?: string;

	@ApiPropertyOptional({
		description: 'URL of the chapter source',
		example: 'https://example.com/book/chapter-1',
		format: 'url',
	})
	@IsUrl()
	@IsOptional()
	url?: string;

	@ApiProperty({
		description: 'Chapter order index',
		example: 1,
		minimum: 1,
	})
	@IsNumber()
	@IsPositive()
	index: number;
}
