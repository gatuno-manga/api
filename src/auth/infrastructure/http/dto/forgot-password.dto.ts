import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
	@ApiProperty({
		example: 'user@example.com',
		description: 'The email address associated with the account',
	})
	@IsEmail()
	email: string;
}
