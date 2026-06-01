import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class OfflineSyncQueryDto {
	@ApiPropertyOptional({
		description:
			'Data da última sincronização para buscar apenas deltas (ISO-8601)',
		example: '2023-01-01T00:00:00Z',
	})
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	updatedSince?: Date;
}
