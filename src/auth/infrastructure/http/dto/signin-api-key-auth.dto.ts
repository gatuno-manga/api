import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SignInApiKeyAuthDto {
	@ApiProperty({
		description: 'API key de login no formato {keyId}.{secret}',
		example:
			'550e8400-e29b-41d4-a716-446655440000.4a4f706d2f7f39f63011a9fd5798f986',
	})
	@IsString()
	@MinLength(20)
	apiKey: string;
}
