import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChapterCommentDto {
	@ApiProperty({
		description: 'Comment text content',
		example: 'Capitulo muito bom, curti o plot twist.',
		maxLength: 2000,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	content: string;
}
