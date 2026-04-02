import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSavedPageDto {
	@ApiPropertyOptional({
		description: 'Updated comment about this saved page',
		example: 'Updated: This scene is even better than I thought!',
		maxLength: 1000,
	})
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	comment?: string | null;

	@ApiPropertyOptional({
		description: 'Whether this saved page is publicly visible',
		example: true,
	})
	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;
}
