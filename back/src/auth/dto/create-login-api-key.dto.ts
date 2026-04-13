import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreateLoginApiKeyDto {
	@ApiPropertyOptional({
		description:
			'Tempo de expiração da API key (ex: 30m, 2h, 1d). Default: 1h',
		example: '2h',
	})
	@IsOptional()
	@IsString()
	@Matches(/^\d+\s*(s|m|h|d|w)$/)
	expiresIn?: string;

	@ApiPropertyOptional({
		description: 'Define se a chave pode ser usada apenas uma vez',
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	singleUse?: boolean;
}
