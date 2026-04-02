import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
