import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsStrongPassword } from 'class-validator';

export class SignUpAuthDto {
	@ApiProperty({
		description: 'User email address',
		example: 'user@example.com',
		format: 'email',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description:
			'User password (minimum 8 characters, at least 1 number, 1 symbol, and 1 uppercase letter)',
		example: 'MyP@ssw0rd',
		minLength: 8,
		format: 'password',
	})
	@IsStrongPassword({
		minLength: 8,
		minNumbers: 1,
		minSymbols: 1,
		minUppercase: 1,
	})
	password: string;
}
