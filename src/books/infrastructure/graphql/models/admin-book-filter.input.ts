import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { BookFilterInput } from './book-filter.input';

@InputType('AdminBookFilterInput')
export class AdminBookFilterInput extends BookFilterInput {
	@Field(() => [ScrapingStatus], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@IsEnum(ScrapingStatus, { each: true })
	scrapingStatus?: ScrapingStatus[];
}
