import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PageOptionsDto {
	@ApiProperty({
		description: 'Page number for pagination',
		example: 1,
		minimum: 1,
		default: 1,
	})
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page: number = 1;

	@ApiProperty({
		description: 'Number of items per page',
		example: 10,
		minimum: 5,
		default: 10,
	})
	@Type(() => Number)
	@IsInt()
	@Min(5)
	readonly limit: number = 10;
}
