import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class UpdateGroupDto {
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(80)
	@ApiPropertyOptional({ example: 'Grupo VIP' })
	name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ApiPropertyOptional({ example: 'Grupo de parceiros' })
	description?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(99)
	@ApiPropertyOptional({ example: 50 })
	defaultMaxWeightSensitiveContent?: number;
}
