import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BookType } from '@books/domain/enums/book-type.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { ImageMetadataModel } from '@common/infrastructure/graphql/models/image-metadata.model';
import { ChapterModel } from './chapter.model';

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

	@Field(() => ImageMetadataModel, { nullable: true })
	metadata?: ImageMetadataModel;
}

@ObjectType('Book')
export class BookModel {
	@Field(() => ID)
	id: string;

	@Field()
	title: string;

	@Field(() => [String], { nullable: 'items' })
	alternativeTitle: string[];

	@Field(() => [AuthorModel], { nullable: 'itemsAndList' })
	authors: AuthorModel[];

	@Field(() => [TagModel], { nullable: 'itemsAndList' })
	tags: TagModel[];

	@Field(() => [CoverModel], { nullable: 'itemsAndList' })
	covers: CoverModel[];

	@Field({ nullable: true })
	cover?: string;

	@Field(() => [ChapterModel], { nullable: 'itemsAndList' })
	chapters: ChapterModel[];

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
