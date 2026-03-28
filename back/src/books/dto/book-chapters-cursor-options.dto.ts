import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum OrderDirection {
	ASC = 'ASC',
	DESC = 'DESC',
}

export class BookChaptersCursorOptionsDto {
	@ApiPropertyOptional({
		description: 'Cursor da próxima página em base64',
		example: 'MTAwLjA=',
	})
	@IsOptional()
	@IsString()
	cursor?: string;

	@ApiPropertyOptional({
		description: 'Quantidade máxima de capítulos por página',
		example: 200,
		default: 200,
		minimum: 1,
		maximum: 500,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(500)
	limit = 200;

	@ApiPropertyOptional({
		description: 'Direção da ordenação',
		enum: OrderDirection,
		default: OrderDirection.ASC,
	})
	@IsOptional()
	@IsEnum(OrderDirection)
	order?: OrderDirection = OrderDirection.ASC;
}
