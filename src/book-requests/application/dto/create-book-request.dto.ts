import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	MaxLength,
} from 'class-validator';

export class CreateBookRequestDto {
	@ApiProperty({ description: 'The title of the book' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	title: string;

	@ApiProperty({ description: 'The URL where the book can be found' })
	@IsString()
	@IsNotEmpty()
	@IsUrl()
	url: string;

	@ApiPropertyOptional({ description: 'Optional reason for the request' })
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	reason?: string;
}
