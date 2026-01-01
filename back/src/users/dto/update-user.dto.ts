import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
	@ApiPropertyOptional({
		description: 'User username for display',
		example: 'john_doe',
		minLength: 3,
		maxLength: 50,
	})
	@IsString()
	@IsOptional()
	userName: string;

	@ApiPropertyOptional({
		description: 'User full name',
		example: 'John Doe',
		maxLength: 100,
	})
	@IsString()
	@IsOptional()
	name: string;
}
