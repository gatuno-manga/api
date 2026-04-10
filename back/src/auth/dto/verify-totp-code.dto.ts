import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyTotpCodeDto {
	@ApiProperty({
		description: 'TOTP code from authenticator app or backup code',
		example: '123456',
	})
	@IsString()
	@Length(6, 64)
	code: string;
}
