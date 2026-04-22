import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class BeginPasskeyAuthDto {
	@ApiProperty({
		description: 'User email used to resolve allowed passkeys',
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;
}
