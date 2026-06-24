import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateCollectionDto {
	@ApiPropertyOptional({ description: 'The title of the collection' })
	@IsString()
	@IsOptional()
	title?: string;

	@ApiPropertyOptional({ description: 'The description of the collection' })
	@IsString()
	@IsOptional()
	description?: string | null;

	@ApiPropertyOptional({ description: 'Whether the collection is public' })
	@IsBoolean()
	@IsOptional()
	isPublic?: boolean;

	@ApiPropertyOptional({ description: 'The cover URL of the collection' })
	@IsUrl()
	@IsOptional()
	coverUrl?: string | null;
}
