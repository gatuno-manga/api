import { SUPPORTED_LANGUAGE_CODES } from '@common/domain/constants/languages.constant';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

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
		enum: SUPPORTED_LANGUAGE_CODES,
	})
	@IsString()
	@IsIn(SUPPORTED_LANGUAGE_CODES)
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
