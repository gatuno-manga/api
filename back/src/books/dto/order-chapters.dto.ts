import { IsNumber, IsPositive, IsString } from 'class-validator';

export class OrderChaptersDto {
	@IsString()
	id: string;

	@IsNumber()
	@IsPositive()
	index: number;
}
