import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ImageMetadata')
export class ImageMetadataModel {
	@Field(() => Int)
	width: number;

	@Field(() => Int)
	height: number;

	@Field(() => Int, { nullable: true })
	sizeBytes?: number;

	@Field({ nullable: true })
	mimeType?: string;

	@Field({ nullable: true })
	blurHash?: string;

	@Field({ nullable: true })
	dominantColor?: string;
}

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
