import { NormalizeUrl } from '@common/decorators/normalize-url.decorator';
import { IsString, IsUrl } from 'class-validator';

export class UrlImageDto {
	@NormalizeUrl()
	@IsUrl()
	url: string;

	@IsString()
	title: string;
}
