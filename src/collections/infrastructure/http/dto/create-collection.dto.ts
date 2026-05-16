import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCollectionDto {
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
