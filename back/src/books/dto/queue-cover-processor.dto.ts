import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsUUID, IsUrl, ValidateNested } from 'class-validator';
import { UrlImageDto } from './url-image.dto';

export class QueueCoverProcessorDto {
	@ApiProperty({
		description: 'Book unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@IsUUID('4')
	bookId!: string;

	@ApiProperty({
		description: 'Source URL where covers were collected',
		example: 'https://example.com/book/one-piece',
	})
	@IsUrl()
	urlOrigin!: string;

	@ApiProperty({
		description: 'Cover list extracted from source URL',
		type: [UrlImageDto],
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => UrlImageDto)
	covers!: UrlImageDto[];
}
