import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInAuthDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
		format: 'email',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description: 'User password',
		example: 'MyP@ssw0rd',
		minLength: 8,
		format: 'password',
	})
	@IsString()
	@MinLength(8)
	password: string;
}
