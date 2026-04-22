import { ApiProperty } from '@nestjs/swagger';
import {
	IsBoolean,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
} from 'class-validator';

export class UpdateChapterCommentDto {
	@ApiProperty({
		description: 'Updated comment content',
		example: 'Atualizando meu comentario apos reler o capitulo.',
		maxLength: 2000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	content: string;

	@ApiProperty({
		description: 'Whether comment is publicly visible',
		example: true,
		required: false,
	})
	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;
}
