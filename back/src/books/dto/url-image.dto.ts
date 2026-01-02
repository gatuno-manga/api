import { IsString, IsUrl } from 'class-validator';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';

export class UrlImageDto {
	@NormalizeUrl()
	@IsUrl()
	url: string;

	@IsString()
	title: string;
}
