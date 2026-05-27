import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional } from 'class-validator';

export class VerifyPasskeyAuthDto {
	@ApiProperty({
		description:
			'User email used to resolve allowed passkeys (optional for nameless login)',
		example: 'user@example.com',
		required: false,
	})
	@IsOptional()
	@IsEmail()
	email?: string;

	@ApiProperty({
		description: 'WebAuthn authentication response JSON from browser',
		type: Object,
	})
	@IsObject()
	response: Record<string, unknown>;
}
