import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';

export class AddBookCollectionDto {
	@ApiProperty({
		description: 'Array of book IDs to add to the collection',
		example: [
			'550e8400-e29b-41d4-a716-446655440000',
			'6ba7b810-9dad-11d1-80b4-00c04fd430c8',
		],
		type: [String],
		isArray: true,
	})
	@IsArray()
	idsBook: string[];
}
