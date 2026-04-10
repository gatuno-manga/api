import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeSessionDto {
	@ApiPropertyOptional({
		description: 'Optional reason registered in audit trail',
		example: 'Suspicious activity',
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	reason?: string;
}
