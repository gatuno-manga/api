import { ApiProperty } from '@nestjs/swagger';
import { IsArray } from 'class-validator';
import { MetadataPageDto } from './metadata-page.dto';

export class PageDto<T> {
	@ApiProperty({
		description: 'Array of items for the current page',
		isArray: true,
	})
	@IsArray()
	readonly data: T[];

	@ApiProperty({
		description: 'Pagination metadata',
		type: MetadataPageDto,
	})
	metadata: MetadataPageDto;

	constructor(data: T[], meta: MetadataPageDto) {
		this.data = data;
		this.metadata = meta;
	}
}
