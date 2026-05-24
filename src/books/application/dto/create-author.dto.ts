import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { LocalizedBiographyDto } from './localized-biography.dto';

export class CreateAuthorDto {
	@ApiProperty({
		description: 'Author name',
		example: 'J.K. Rowling',
		maxLength: 200,
	})
	@IsString()
	@MinLength(2)
	@MaxLength(200)
	name: string;

	@ApiPropertyOptional({
		description: 'Author biographies in multiple languages',
		type: [LocalizedBiographyDto],
		isArray: true,
	})
	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => LocalizedBiographyDto)
	localizedBiographies?: LocalizedBiographyDto[];

	@ApiPropertyOptional({
		description:
			'Author biography (Legacy - will be mapped to localizedBiographies)',
		example: 'British author, best known for the Harry Potter series',
		maxLength: 1000,
		deprecated: true,
	})
	@IsString()
	@IsOptional()
	@MaxLength(1000)
	biography?: string;
}
