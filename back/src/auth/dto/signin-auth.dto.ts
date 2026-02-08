import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

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
		format: 'password',
	})
	@IsString()
	password: string;
}
