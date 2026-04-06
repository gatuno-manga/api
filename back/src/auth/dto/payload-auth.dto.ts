import { ApiProperty } from '@nestjs/swagger';
import {
	IsArray,
	IsEmail,
	IsInt,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';

export class PayloadAuthDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description: 'User subject identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	sub: string;

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
