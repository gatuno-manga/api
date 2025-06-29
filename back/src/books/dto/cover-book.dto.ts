import { IsString } from 'class-validator';

export class CoverBookDto {
	@IsString()
	urlImg: string;

	@IsString()
	urlOrigin: string;
}
