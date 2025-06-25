import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateChapterDto {
	@IsString()
	@IsOptional()
	title?: string;

	@IsUrl()
	url: string;
}
