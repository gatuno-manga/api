import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAuthorDto {
	@ApiProperty({
		description: 'Author name',
		example: 'J.K. Rowling',
		maxLength: 200,
	})
	@IsString()
	@MinLength(2)
	@MaxLength(200)
	name: string;

	@ApiPropertyOptional({
		description: 'Author biography',
		example: 'British author, best known for the Harry Potter series',
		maxLength: 1000,
	})
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	biography?: string;
}
