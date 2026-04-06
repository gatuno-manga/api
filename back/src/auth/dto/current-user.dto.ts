import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString, IsUUID, Min } from 'class-validator';

export class CurrentUserDto {
	@ApiProperty({
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	userId: string;

	@ApiProperty({
		description: 'Username',
		example: 'john_doe',
	})
	@IsString()
	username: string;

	@ApiProperty({
		description: 'User roles',
		example: ['user', 'admin'],
		type: [String],
		isArray: true,
	})
	@IsArray()
	@IsString({ each: true })
	roles: string[];

	@ApiProperty({
		description: 'Maximum weight for sensitive content filtering',
		example: 5,
	})
	@IsInt()
	@Min(0)
	maxWeightSensitiveContent: number;
}
