import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

export class ListAuthAuditQueryDto {
	@ApiPropertyOptional({
		description: 'Page number (1-based)',
		default: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number = 1;

	@ApiPropertyOptional({
		description: 'Items per page',
		default: 20,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Optional event filter (e.g. login_success)',
	})
	@IsOptional()
	@IsString()
	@MaxLength(80)
	event?: string;
}
