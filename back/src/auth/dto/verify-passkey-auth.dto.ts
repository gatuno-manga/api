import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsObject } from 'class-validator';

export class VerifyPasskeyAuthDto {
	@ApiProperty({
		description: 'User email used to resolve allowed passkeys',
		example: 'user@example.com',
	})
	@IsEmail()
	email: string;

	@ApiProperty({
		description: 'WebAuthn authentication response JSON from browser',
		type: Object,
	})
	@IsObject()
	response: Record<string, unknown>;
}
