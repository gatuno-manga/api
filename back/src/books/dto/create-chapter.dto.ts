import {
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
	@ApiPropertyOptional({
		description: 'Chapter title',
		example: 'Chapter 1: The Beginning',
		maxLength: 200,
	})
	@IsString()
	@IsOptional()
	title?: string;

	@ApiPropertyOptional({
		description: 'URL of the chapter source (optional for manual upload)',
		example: 'https://example.com/book/chapter-1',
		format: 'url',
	})
	@IsUrl()
	@IsOptional()
	url?: string;

	@ApiPropertyOptional({
		description: 'Chapter order index',
		example: 1,
		minimum: 1,
	})
	@IsNumber()
	@IsPositive()
	@IsOptional()
	index?: number;
}
