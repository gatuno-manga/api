import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectBookRequestDto {
	@ApiPropertyOptional({
		description: 'Optional message explaining why the request was rejected',
	})
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	message?: string;
}
