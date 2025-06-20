import { IsString, IsUrl } from 'class-validator';

export class CreateChapterDto {
	@IsString()
	title: string;

	@IsUrl()
	url: string;
}
