import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class CreateGroupDto {
	@IsString()
	@MinLength(2)
	@MaxLength(80)
	@ApiProperty({ example: 'Grupo Beta Teste' })
	name: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	@ApiPropertyOptional({ example: 'Grupo com acesso de revisao interna' })
	description?: string;

	@IsInt()
	@Min(0)
	@Max(99)
	@ApiProperty({ example: 10 })
	defaultMaxWeightSensitiveContent: number;
}
