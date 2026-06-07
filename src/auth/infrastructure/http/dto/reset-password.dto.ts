import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
	@ApiProperty({
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description: 'The token received in the reset email',
	})
	@IsString()
	@IsNotEmpty()
	token: string;

	@ApiProperty({
		example: 'NewSecureP@ssw0rd',
		description: 'The new password',
	})
	@IsString()
	@MinLength(8)
	newPassword: string;
}
