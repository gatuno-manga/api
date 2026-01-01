import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

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
