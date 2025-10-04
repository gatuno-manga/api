import { ApiProperty } from '@nestjs/swagger';

export class PayloadAuthDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	email: string;

	@ApiProperty({
		description: 'User subject identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	sub: string;

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
