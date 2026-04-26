import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ContentType } from '../../../domain/enums/content-type.enum';
import { ContentFormat } from '../../../domain/enums/content-format.enum';
import { DocumentFormat } from '../../../domain/enums/document-format.enum';
import { ScrapingStatus } from '../../../domain/enums/scrapingStatus.enum';
import { PageModel } from './page.model';

registerEnumType(ContentType, { name: 'ContentType' });
registerEnumType(ContentFormat, { name: 'ContentFormat' });
registerEnumType(DocumentFormat, { name: 'DocumentFormat' });

@ObjectType('Chapter')
export class ChapterModel {
	@Field(() => ID)
	id: string;

	@Field(() => String, { nullable: true })
	title: string | null;

	@Field(() => Int)
	index: number;

	@Field(() => ContentType)
	contentType: ContentType;

	@Field(() => String, { nullable: true })
	content: string | null;

	@Field(() => ContentFormat, { nullable: true })
	contentFormat: ContentFormat | null;

	@Field(() => DocumentFormat, { nullable: true })
	documentFormat: DocumentFormat | null;

	@Field(() => ScrapingStatus, { nullable: true })
	scrapingStatus: ScrapingStatus | null;

	@Field(() => [PageModel], { nullable: 'itemsAndList' })
	pages: PageModel[];

	@Field()
	isFinal: boolean;
}
