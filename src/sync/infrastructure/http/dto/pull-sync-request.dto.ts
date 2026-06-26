import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class PullSyncRequestDto {
	@ApiPropertyOptional({
		description: 'Timestamp da última sincronização bem-sucedida',
		example: '2026-06-25T10:00:00Z',
	})
	@IsOptional()
	@IsDateString()
	lastSyncAt?: string;
}
