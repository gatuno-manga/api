import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';

export class UpdateUserDto {
	@ApiPropertyOptional({
		description: 'User username for display',
		example: 'john_doe',
		minLength: 3,
		maxLength: 50,
	})
	@IsString()
	@MinLength(3)
	@MaxLength(50)
	@IsOptional()
	userName: string;

	@ApiPropertyOptional({
		description: 'User full name',
		example: 'John Doe',
		maxLength: 100,
	})
	@IsString()
	@MaxLength(100)
	@IsOptional()
	name: string;

	@ApiPropertyOptional({
		description: 'Maximum weight for sensitive content filtering',
		example: 4,
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(99)
	maxWeightSensitiveContent?: number;

	@ApiPropertyOptional({
		description: 'User preferred language (BCP 47)',
		example: 'pt-BR',
		maxLength: 10,
	})
	@IsOptional()
	@IsString()
	@MaxLength(10)
	preferredLanguage?: string;

	@ApiPropertyOptional({
		description: 'User settings and preferences in JSON format',
		example: { theme: 'dark' },
	})
	@IsOptional()
	@IsObject()
	preferences?: Record<string, unknown>;
}
