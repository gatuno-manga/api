import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class AdminUpdateUserDto {
	@IsOptional()
	@IsString()
	@MinLength(3)
	@MaxLength(32)
	@ApiPropertyOptional({ example: 'luis123' })
	userName?: string;

	@IsOptional()
	@IsString()
	@MaxLength(80)
	@ApiPropertyOptional({ example: 'Luis Silva' })
	name?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(99)
	@ApiPropertyOptional({ example: 4 })
	maxWeightSensitiveContent?: number;

	@IsOptional()
	@IsBoolean()
	@ApiPropertyOptional({ example: false })
	isBanned?: boolean;

	@IsOptional()
	@IsDateString()
	@ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
	suspendedUntil?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ApiPropertyOptional({ example: 'Suspensao manual por moderacao' })
	suspensionReason?: string;
}
