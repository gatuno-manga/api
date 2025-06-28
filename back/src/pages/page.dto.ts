import { IsArray } from 'class-validator';
import { MetadataPageDto } from './metadata-page.dto';

export class PageDto<T> {
	@IsArray()
	readonly data: T[];

	metadata: MetadataPageDto;

	constructor(data: T[], meta: MetadataPageDto) {
		this.data = data;
		this.metadata = meta;
	}
}
