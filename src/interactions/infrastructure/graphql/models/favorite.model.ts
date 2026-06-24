import { BookModel } from '@/books/infrastructure/graphql/models/book.model';
import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Favorite')
export class FavoriteModel {
	@Field()
	userId: string;

	@Field()
	bookId: string;

	@Field()
	createdAt: Date;
}

@ObjectType('PaginatedFavoriteResponse')
export class PaginatedFavoriteResponseModel {
	@Field(() => [FavoriteModel])
	data: FavoriteModel[];

	@Field({ nullable: true })
	nextCursor?: string;

	@Field()
	hasNextPage: boolean;

	@Field(() => Int, { nullable: true })
	total?: number;

	@Field(() => Int, { nullable: true })
	page?: number;

	@Field(() => Int, { nullable: true })
	lastPage?: number;
}
