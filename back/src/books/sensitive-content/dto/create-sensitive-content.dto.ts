import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSensitiveContentDto {
	@ApiProperty({
		description: 'Sensitive content name/label',
		example: 'Violence',
		maxLength: 100,
	})
	@IsString()
	name: string;

	@ApiPropertyOptional({
		description: 'Severity weight of the content (0-10)',
		example: 5,
		minimum: 0,
		default: 0,
	})
	@IsInt()
	@Min(0)
	@IsOptional()
	weight?: number;
}
