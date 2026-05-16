import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddBookDto {
	@ApiProperty({ example: 'book-uuid-here' })
	@IsUUID()
	bookId: string;
}
