import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class UpdateRoleDto {
	@IsOptional()
	@IsString()
	@MinLength(2)
	@MaxLength(40)
	@ApiPropertyOptional({ example: 'moderador' })
	name?: string;

	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(99)
	@ApiPropertyOptional({ example: 20 })
	maxWeightSensitiveContent?: number;

	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	@ApiPropertyOptional({
		description: 'List of permission names to assign to this role',
		example: ['books:create', 'books:edit'],
	})
	permissions?: string[];
}
