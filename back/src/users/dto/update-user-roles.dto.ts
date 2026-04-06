import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdateUserRolesDto {
	@IsArray()
	@ArrayMinSize(1)
	@IsString({ each: true })
	@ApiProperty({
		type: [String],
		example: ['admin', 'user'],
	})
	roles: string[];
}
