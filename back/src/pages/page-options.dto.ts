import { IsInt, Min } from 'class-validator';

export class PageOptionsDto {
	@IsInt()
	@Min(1)
	page: number = 1;

	@IsInt()
	@Min(5)
	readonly limit: number = 10;
}
