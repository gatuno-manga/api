import { BookModel } from '@/books/infrastructure/graphql/models/book.model';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Collection')
export class CollectionModel {
	@Field(() => ID)
	id: string;

	@Field()
	ownerId: string;

	@Field()
	title: string;

	@Field(() => String, { nullable: true })
	description: string | null;

	@Field(() => String, { nullable: true })
	coverUrl: string | null;

	@Field()
	visibility: string;

	@Field(() => [String])
	collaborators: string[];

	@Field(() => [String])
	books: string[];

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}

@ObjectType('PaginatedCollectionResponse')
export class PaginatedCollectionResponseModel {
	@Field(() => [CollectionModel])
	data: CollectionModel[];

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
