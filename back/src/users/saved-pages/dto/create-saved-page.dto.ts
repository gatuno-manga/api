import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsInt,
	IsOptional,
	IsPositive,
	IsString,
	IsUUID,
	MaxLength,
} from 'class-validator';

export class CreateSavedPageDto {
	@ApiProperty({
		description: 'ID of the page to save',
		example: 1,
	})
	@IsInt()
	@IsPositive()
	pageId: number;

	@ApiProperty({
		description: 'ID of the chapter containing the page',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID()
	chapterId: string;

	@ApiProperty({
		description: 'ID of the book containing the chapter',
		example: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
	})
	@IsUUID()
	bookId: string;

	@ApiPropertyOptional({
		description: 'Optional comment about this saved page',
		example: 'This is an amazing scene!',
		maxLength: 1000,
	})
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	comment?: string;
}
