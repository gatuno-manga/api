import { ApiProperty } from '@nestjs/swagger';
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsString,
	MaxLength,
} from 'class-validator';

export class UpdateUserRolesDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(20)
	@IsString({ each: true })
	@MaxLength(40, { each: true })
	@ApiProperty({
		type: [String],
		example: ['admin', 'user'],
	})
	roles: string[];
}
