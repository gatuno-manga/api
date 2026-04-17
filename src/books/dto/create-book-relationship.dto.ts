import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsBoolean,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { BookRelationType } from '../enum/book-relation-type.enum';

export class CreateBookRelationshipDto {
	@ApiProperty({
		description: 'ID do livro relacionado',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	targetBookId!: string;

	@ApiProperty({
		description: 'Tipo de relacionamento entre os livros',
		enum: BookRelationType,
		example: BookRelationType.SEQUENCE,
	})
	@IsEnum(BookRelationType)
	relationType!: BookRelationType;

	@ApiPropertyOptional({
		description: 'Indica se a relação é bidirecional',
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	isBidirectional?: boolean = false;

	@ApiPropertyOptional({
		description: 'Ordem da relação, útil para sequências',
		example: 1,
		minimum: 1,
		maximum: 100000,
	})
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100000)
	order?: number;

	@ApiPropertyOptional({
		description: 'Observação opcional sobre a relação',
		example: 'A história ocorre após o volume 12 da obra principal.',
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string;

	@ApiPropertyOptional({
		description: 'Peso opcional de relevância da relação',
		example: 80,
		minimum: 0,
		maximum: 100,
	})
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	@Max(100)
	weight?: number;
}
