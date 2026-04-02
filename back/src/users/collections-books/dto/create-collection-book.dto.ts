import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCollectionBookDto {
	@ApiProperty({
		description: 'Collection title',
		example: 'My Favorite Books',
		minLength: 3,
		maxLength: 100,
	})
	@IsString()
	title: string;

	@ApiPropertyOptional({
		description: 'Collection description',
		example: 'A collection of my all-time favorite manga',
		maxLength: 500,
	})
	@IsString()
	@IsOptional()
	description?: string;

	@ApiPropertyOptional({
		description: 'Whether this collection is publicly visible',
		example: false,
	})
	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;
}
