import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
