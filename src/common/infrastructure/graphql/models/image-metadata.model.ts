import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

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

	@Field({ nullable: true })
	pHash?: string;

	@Field(() => Float, { nullable: true })
	entropy?: number;

	@Field({ nullable: true })
	formatOrigin?: string;
}
