import { SUPPORTED_LANGUAGE_CODES } from '@common/domain/constants/languages.constant';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class AlternativeTitleDto {
	@ApiProperty({
		description: 'Alternative title',
		example: 'ワンピース',
		maxLength: 500,
	})
	@IsString()
	@MaxLength(500)
	title: string;

	@ApiPropertyOptional({
		description: 'BCP 47 language code',
		example: 'ja-JP',
		enum: SUPPORTED_LANGUAGE_CODES,
	})
	@IsOptional()
	@IsString()
	@IsIn(SUPPORTED_LANGUAGE_CODES)
	languageCode?: string;

	@ApiPropertyOptional({
		description: 'Sorting rank (higher is prioritized)',
		example: 10,
		default: 0,
	})
	@IsOptional()
	@IsInt()
	rank?: number = 0;
}
