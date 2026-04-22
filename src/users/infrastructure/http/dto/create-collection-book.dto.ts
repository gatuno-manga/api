import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';

export class CreateCollectionBookDto {
	@ApiProperty({
		description: 'Collection title',
		example: 'My Favorite Books',
		minLength: 3,
		maxLength: 100,
	})
	@IsString()
	@MinLength(3)
	@MaxLength(100)
	title: string;

	@ApiPropertyOptional({
		description: 'Collection description',
		example: 'A collection of my all-time favorite manga',
		maxLength: 500,
	})
	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;

	@ApiPropertyOptional({
		description: 'Whether this collection is publicly visible',
		example: false,
	})
	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;
}
