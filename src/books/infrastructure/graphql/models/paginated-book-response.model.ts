import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BookModel } from './book.model';

@ObjectType('PaginatedBookResponse')
export class PaginatedBookResponseModel {
	@Field(() => [BookModel])
	data: BookModel[];

	@Field(() => Int, { nullable: true })
	total?: number;

	@Field(() => Int, { nullable: true })
	page?: number;

	@Field(() => Int, { nullable: true })
	lastPage?: number;

	@Field(() => String, { nullable: true })
	nextCursor?: string | null;

	@Field({ nullable: true })
	hasNextPage?: boolean;
}
