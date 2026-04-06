import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class UpdateGroupMembersDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(200)
	@IsUUID('4', { each: true })
	@ApiProperty({
		type: [String],
		example: ['550e8400-e29b-41d4-a716-446655440000'],
	})
	userIds: string[];
}
