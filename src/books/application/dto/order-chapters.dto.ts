import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class OrderChaptersDto {
	@ApiProperty({
		description: 'Chapter unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	id: string;

	@ApiProperty({
		description: 'New order index for the chapter',
		example: 1,
		minimum: 1,
	})
	@Type(() => Number)
	@IsNumber()
	@IsPositive()
	index: number;
}
