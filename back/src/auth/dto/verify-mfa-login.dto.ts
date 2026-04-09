import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyMfaLoginDto {
	@ApiProperty({
		description:
			'Short-lived token generated during primary authentication',
	})
	@IsString()
	mfaToken: string;

	@ApiProperty({
		description: 'TOTP code from authenticator app or backup code',
		example: '123456',
	})
	@IsString()
	@Length(6, 64)
	code: string;
}
