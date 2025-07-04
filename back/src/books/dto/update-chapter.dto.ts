import {
	IsNumber,
	IsOptional,
	IsPositive,
	IsString,
	IsUrl,
} from 'class-validator';

export class UpdateChapterDto {
	@IsString()
	@IsOptional()
	title?: string;

	@IsUrl()
	@IsOptional()
	url?: string;

	@IsNumber()
	@IsPositive()
	index: number;
}
