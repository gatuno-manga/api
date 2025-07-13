import { IsEmail, IsStrongPassword } from 'class-validator';

export class SignUpAuthDto {
	@IsEmail()
	email: string;

	@IsStrongPassword({
		minLength: 8,
		minNumbers: 1,
		minSymbols: 1,
		minUppercase: 1,
	})
	password: string;
}
