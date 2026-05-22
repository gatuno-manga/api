import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

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
		maxLength: 10,
	})
	@IsOptional()
	@IsString()
	@MaxLength(10)
	languageCode?: string;
}
