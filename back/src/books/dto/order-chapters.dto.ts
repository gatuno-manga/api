import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';

export class OrderChaptersDto {
	@ApiProperty({
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsString()
	id: string;

	@ApiProperty({
		description: 'New order index for the chapter',
		example: 1,
		minimum: 1,
	})
	@IsNumber()
	@IsPositive()
	index: number;
}
