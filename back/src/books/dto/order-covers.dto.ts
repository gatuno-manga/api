import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class OrderCoversDto {
	@ApiProperty({
		description: 'Cover unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	id: string;

	@ApiProperty({
		description: 'New order index for the cover',
		example: 0,
		minimum: 0,
	})
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	index: number;
}
