import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyPasskeyRegistrationDto {
	@ApiProperty({
		description: 'WebAuthn registration response JSON from browser',
		type: Object,
	})
	@IsObject()
	response: Record<string, unknown>;

	@ApiProperty({
		description: 'Optional friendly name for the passkey',
		example: 'Chrome no notebook',
		required: false,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	name?: string;
}
