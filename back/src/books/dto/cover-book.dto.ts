import { IsString, IsArray, ValidateNested, IsUrl, ArrayMinSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { UrlImageDto } from './url-image.dto';

export class CoverBookDto {
	@IsArray()
	@ValidateNested({ each: true })
	@ArrayMinSize(1, { message: 'At least one image is required' })
	@Type(() => UrlImageDto)
	urlImgs: UrlImageDto[];

	@IsUrl()
	urlOrigin: string;
}
