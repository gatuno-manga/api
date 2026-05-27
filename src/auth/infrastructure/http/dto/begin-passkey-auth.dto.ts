import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class BeginPasskeyAuthDto {
	@ApiProperty({
		description:
			'User email used to resolve allowed passkeys (optional for nameless login)',
		example: 'user@example.com',
		required: false,
	})
	@IsOptional()
	@IsEmail()
	email?: string;
}
