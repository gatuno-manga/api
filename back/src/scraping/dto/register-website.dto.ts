import { IsOptional, IsString, IsUrl } from 'class-validator';

export class RegisterWebSiteDto {
	@IsUrl()
	url: string;

	@IsString()
	@IsOptional()
	preScript?: string;

	@IsString()
	@IsOptional()
	posScript?: string;

	@IsString()
	selector: string;

	@IsOptional()
	@IsString({ each: true })
	ignoreFiles?: string[];
}
