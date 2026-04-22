import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

export class SetUserModerationDto {
	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ example: true })
	isBanned?: boolean;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
	suspendedUntil?: string | null;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ApiPropertyOptional({ example: 'Conteudo em revisao' })
	suspensionReason?: string;
}
