import { ApiProperty } from '@nestjs/swagger';
import {
	IsInt,
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
}
