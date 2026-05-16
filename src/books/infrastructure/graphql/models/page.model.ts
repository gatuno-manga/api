import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ImageMetadataModel } from '@common/infrastructure/graphql/models/image-metadata.model';

@ObjectType('Page')
export class PageModel {
	@Field(() => Int)
	id: number;

	@Field(() => Int)
	index: number;

	@Field()
	path: string;

	@Field(() => ImageMetadataModel, { nullable: true })
	metadata?: ImageMetadataModel;
}
