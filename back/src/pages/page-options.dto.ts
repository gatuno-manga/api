import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PageOptionsDto {
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page: number = 1;

	@Type(() => Number)
	@IsInt()
	@Min(5)
	readonly limit: number = 10;
}
