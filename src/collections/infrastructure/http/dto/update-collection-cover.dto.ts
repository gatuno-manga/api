import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCollectionCoverDto {
	@ApiPropertyOptional({
		description: 'The URL of the collection cover',
		example: 'https://example.com/cover.jpg',
	})
	@IsOptional()
	@IsString()
	@IsUrl()
	coverUrl?: string;
}
