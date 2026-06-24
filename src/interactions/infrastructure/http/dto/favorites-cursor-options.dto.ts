import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FavoritesCursorOptionsDto {
	@ApiPropertyOptional({
		description: 'Cursor para a próxima página (base64)',
	})
	@IsOptional()
	@IsString()
	cursor?: string;

	@ApiPropertyOptional({
		description: 'Limite de itens por página',
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 20;

	@ApiPropertyOptional({
		description: 'Página atual (para paginação baseada em offset)',
		minimum: 1,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page?: number;
}
