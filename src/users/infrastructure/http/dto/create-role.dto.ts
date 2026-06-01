import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateRoleDto {
	@IsString()
	@MinLength(2)
	@MaxLength(40)
	@ApiProperty({ example: 'curador' })
	name: string;

	@IsInt()
	@Min(0)
	@Max(99)
	@ApiProperty({ example: 10 })
	maxWeightSensitiveContent: number;

	@IsArray()
	@IsString({ each: true })
	@IsOptional()
	@ApiPropertyOptional({
		description: 'List of permission names to assign to this role',
		example: ['books:create', 'books:edit'],
	})
	permissions?: string[];
}
