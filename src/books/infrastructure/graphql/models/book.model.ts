import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BookType } from '../../../domain/enums/book-type.enum';
import { ScrapingStatus } from '../../../domain/enums/scrapingStatus.enum';

registerEnumType(BookType, { name: 'BookType' });
registerEnumType(ScrapingStatus, { name: 'ScrapingStatus' });

@ObjectType('Author')
export class AuthorModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;
}

@ObjectType('Tag')
export class TagModel {
	@Field(() => ID)
	id: string;

	@Field()
	name: string;
}

@ObjectType('Cover')
export class CoverModel {
	@Field(() => ID)
	id: string;

	@Field()
	url: string;

	@Field()
	isMain: boolean;
}

@ObjectType('Book')
export class BookModel {
	@Field(() => ID)
	id: string;

	@Field()
	title: string;

	@Field(() => [String], { nullable: 'items' })
	alternativeTitle: string[];

	@Field(() => [AuthorModel])
	authors: AuthorModel[];

	@Field(() => [TagModel])
	tags: TagModel[];

	@Field(() => [CoverModel])
	covers: CoverModel[];

	@Field(() => BookType)
	type: BookType;

	@Field(() => String, { nullable: true })
	description: string | null;

	@Field(() => Int, { nullable: true })
	publication: number | null;

	@Field(() => ScrapingStatus)
	scrapingStatus: ScrapingStatus;

	@Field()
	createdAt: Date;

	@Field()
	updatedAt: Date;
}
