import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateChapterDto } from './create-chapter.dto';
import { Type } from 'class-transformer';

export class CreateBookDto {
	@IsString()
	title: string;

	@IsOptional()
	@ValidateNested({ each: true })
	@Type(() => CreateChapterDto)
	chapters?: CreateChapterDto[] = [];
}
