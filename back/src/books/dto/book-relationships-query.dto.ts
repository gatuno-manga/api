import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ToArray } from 'src/pages/decorator/to-array.decorator';
import { BookRelationType } from '../enum/book-relation-type.enum';

export class BookRelationshipsQueryDto {
	@ApiPropertyOptional({
		description: 'Cursor para paginação por cursor',
		example:
			'eyJvcmRlciI6MSwiY3JlYXRlZEF0IjoiMjAyNi0wNC0xMFQwMDowMDowMC4wMDBaIiwiaWQiOiI1NTBlODQwMCJ9',
	})
	@IsOptional()
	@IsString()
	cursor?: string;

	@ApiPropertyOptional({
		description: 'Filtra por tipos de relacionamento',
		enum: BookRelationType,
		isArray: true,
		example: [BookRelationType.SEQUENCE, BookRelationType.SPIN_OFF],
	})
	@IsOptional()
	@ToArray()
	@IsEnum(BookRelationType, { each: true })
	types?: BookRelationType[] = [];

	@ApiPropertyOptional({
		description: 'Quantidade máxima de itens retornados',
		example: 20,
		default: 20,
		minimum: 1,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number = 20;

	@ApiPropertyOptional({
		description: 'Deslocamento para paginação simples',
		example: 0,
		default: 0,
		minimum: 0,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	offset?: number = 0;
}
