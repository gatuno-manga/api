import {
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	ValidateNested,
} from 'class-validator';
import { CreateChapterDto } from './create-chapter.dto';
import { Type } from 'class-transformer';
import { CoverBookDto } from './cover-book.dto';
import { BookType } from '../enum/book-type.enum';
import { SensitiveContent } from '../enum/sensitive-content.enum';

export class CreateBookDto {
	@IsString()
	title: string;

	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[] = [];

	@IsOptional()
	@IsString()
	type?: BookType = BookType.OTHER;

	@IsOptional()
	@IsString({ each: true })
	sensitiveContent?: SensitiveContent[] = [];

	@IsOptional()
	@IsString({ each: true })
	originalUrl?: string[] = [];

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@ValidateNested()
	@Type(() => CoverBookDto)
	cover?: CoverBookDto;

	@IsOptional()
	@IsNumber()
	@IsPositive()
	publication?: number;

	@IsOptional()
	@IsString({ each: true })
	tags?: string[] = [];

	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateChapterDto)
	chapters?: CreateChapterDto[] = [];
}
