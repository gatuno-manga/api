import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	MinLength,
} from 'class-validator';

export class CreateCollectionDto {
	@ApiPropertyOptional({
		example: '123e4567-e89b-12d3-a456-426614174000',
		description: 'Optional client-generated UUID',
	})
	@IsUUID()
	@IsOptional()
	id?: string;

	@ApiProperty({ example: 'My Awesome Collection' })
	@IsString()
	@MinLength(3)
	@MaxLength(100)
	title: string;

	@ApiPropertyOptional({ example: 'Books I really like' })
	@IsString()
	@IsOptional()
	@MaxLength(500)
	description?: string;
}
