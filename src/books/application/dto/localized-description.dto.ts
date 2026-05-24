import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class LocalizedDescriptionDto {
	@ApiProperty({
		description: 'The description content',
		example: 'A story about pirates...',
	})
	@IsString()
	description: string;

	@ApiProperty({
		description: 'BCP 47 language code',
		example: 'en-US',
		maxLength: 10,
	})
	@IsString()
	@MaxLength(10)
	languageCode: string;

	@ApiPropertyOptional({
		description: 'Sorting rank (higher is prioritized)',
		example: 10,
		default: 0,
	})
	@IsOptional()
	@IsInt()
	rank?: number = 0;
}
