import { IsArray, ValidateNested, IsUrl, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UrlImageDto } from './url-image.dto';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';

export class CoverBookDto {
	@IsArray()
	@ValidateNested({ each: true })
	@ArrayMinSize(1, { message: 'At least one image is required' })
	@Type(() => UrlImageDto)
	urlImgs: UrlImageDto[];

	@NormalizeUrl()
	@IsUrl()
	urlOrigin: string;

	static fromLegacyFormat(data: {
		urlImg: string;
		urlOrigin: string;
	}): CoverBookDto {
		const cover = new CoverBookDto();
		const urlImage = new UrlImageDto();
		urlImage.url = data.urlImg;
		urlImage.title = 'cover image';

		cover.urlImgs = [urlImage];
		cover.urlOrigin = data.urlOrigin;

		return cover;
	}
}
