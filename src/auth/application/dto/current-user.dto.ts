import { SUPPORTED_LANGUAGE_CODES } from '@common/domain/constants/languages.constant';
import { ApiProperty } from '@nestjs/swagger';
import {
	IsArray,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Min,
} from 'class-validator';

export class CurrentUserDto {
	@ApiProperty({
		description: 'User unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('all')
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

	@ApiProperty({
		description: 'User preferred language for content',
		example: 'pt-BR',
		required: false,
		enum: SUPPORTED_LANGUAGE_CODES,
	})
	@IsString()
	@IsOptional()
	@IsIn(SUPPORTED_LANGUAGE_CODES)
	preferredLanguage?: string;
	contentLanguages?: string[];

	@ApiProperty({
		description: 'Current logical session identifier',
		example: 'b13e6b8d-b989-4f1f-bf9e-f0e8e2e84d13',
		required: false,
	})
	@IsString()
	sessionId?: string;
}
