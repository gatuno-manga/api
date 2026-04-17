import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNumber } from 'class-validator';

export class UploadPagesDto {
	@ApiProperty({
		description: 'Array of page indices corresponding to uploaded files',
		example: [1, 2, 3, 4, 5],
		type: [Number],
		isArray: true,
	})
	@IsArray()
	@ArrayMinSize(1, { message: 'At least one page index is required' })
	@ArrayMaxSize(100, { message: 'Maximum 100 pages per upload' })
	@IsNumber({}, { each: true })
	@Type(() => Number)
	indices: number[];
}
