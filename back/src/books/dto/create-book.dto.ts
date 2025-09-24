import {
	IsNumber,
	IsObject,
	IsOptional,
	IsPositive,
	IsString,
	ValidateNested,
	IsEnum,
	IsUrl,
	Min,
	Max,
} from 'class-validator';
import { CreateChapterDto } from './create-chapter.dto';
import { Type } from 'class-transformer';
import { CoverBookDto } from './cover-book.dto';
import { BookType } from '../enum/book-type.enum';
import { CreateAuthorDto } from './create-author.dto';

export class CreateBookDto {
	@IsString()
	title: string;

	@IsOptional()
	@IsString({ each: true })
	alternativeTitle?: string[] = [];

	@IsOptional()
	@IsEnum(BookType)
	type?: BookType = BookType.OTHER;

	@IsOptional()
	@IsString({ each: true })
	sensitiveContent?: string[] = [];

	@IsOptional()
	@IsUrl({}, { each: true })
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
	@Min(1980)
	@Max(new Date().getFullYear() + 2)
	@Min(1980)
	@Max(new Date().getFullYear() + 2)
	publication?: number;

	@IsOptional()
	@IsString({ each: true })
	tags?: string[] = [];

	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateAuthorDto)
	authors?: CreateAuthorDto[] = [];

	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateChapterDto)
	chapters?: CreateChapterDto[] = [];
}
