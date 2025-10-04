import { ApiProperty } from '@nestjs/swagger';

export class MetadataPageDto {
	@ApiProperty({
		description: 'Total number of items',
		example: 100,
	})
	total: number;

	@ApiProperty({
		description: 'Current page number',
		example: 1,
	})
	page: number;

	@ApiProperty({
		description: 'Last page number',
		example: 10,
	})
	lastPage: number;
}
