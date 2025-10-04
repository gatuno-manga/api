import { ApiProperty } from '@nestjs/swagger';

export class CurrentUserDto {
	@ApiProperty({
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	userId: string;

	@ApiProperty({
		description: 'Username',
		example: 'john_doe',
	})
	username: string;

	@ApiProperty({
		description: 'User roles',
		example: ['user', 'admin'],
		type: [String],
		isArray: true,
	})
	roles: string[];

	@ApiProperty({
		description: 'Maximum weight for sensitive content filtering',
		example: 5,
	})
	maxWeightSensitiveContent: number;
}
