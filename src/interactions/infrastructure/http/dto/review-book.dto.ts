import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min, MinLength } from 'class-validator';

export class ReviewBookDto {
	@ApiProperty({ example: 5, description: 'Rating score from 1 to 5' })
	@IsInt()
	@Min(1)
	@Max(5)
	rating: number;

	@ApiProperty({ example: 'This book is amazing!', minLength: 10 })
	@IsString()
	@MinLength(10)
	content: string;
}
