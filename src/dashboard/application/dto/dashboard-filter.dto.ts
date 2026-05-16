import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum SensitiveContentFilter {
	ALL = 'all',
	EXCLUDE = 'exclude',
	ONLY = 'only',
}

export class DashboardFilterDto {
	@ApiPropertyOptional({
		enum: SensitiveContentFilter,
		default: SensitiveContentFilter.ALL,
		description: 'Filter statistics by sensitive content',
	})
	@IsOptional()
	@IsEnum(SensitiveContentFilter)
	sensitiveContent?: SensitiveContentFilter = SensitiveContentFilter.ALL;
}
