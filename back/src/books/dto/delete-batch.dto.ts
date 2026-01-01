import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMaxSize } from 'class-validator';

export class DeleteBooksDto {
	@ApiProperty({
		description: 'Array of book IDs to delete',
		example: [
			'550e8400-e29b-41d4-a716-446655440000',
			'6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	@ArrayMaxSize(100)
	bookIds: string[];
}

export class DeleteChaptersDto {
	@ApiProperty({
		description: 'Array of chapter IDs to delete',
		example: ['550e8400-e29b-41d4-a716-446655440000'],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	@ArrayMaxSize(100)
	chapterIds: string[];
}

export class DeleteCoversDto {
	@ApiProperty({
		description: 'Array of cover IDs to delete',
		example: ['6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
		type: [String],
	})
	@IsArray()
	@IsString({ each: true })
	coverIds: string[];
}

export class DeletePagesDto {
	@ApiProperty({
		description: 'Array of page indices to delete',
		example: [1, 2, 3, 4, 5],
		type: [Number],
	})
	@IsArray()
	pageIndices: number[];
}
