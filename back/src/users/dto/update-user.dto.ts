import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
