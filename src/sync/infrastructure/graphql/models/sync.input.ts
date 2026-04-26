import { Field, ID, InputType } from '@nestjs/graphql';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUUID,
	ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

@InputType('ReadingProgressInput')
export class ReadingProgressInput {
	@Field(() => ID)
	@IsUUID()
	bookId: string;

	@Field(() => ID)
	@IsUUID()
	chapterId: string;

	@Field()
	@IsInt()
	pageIndex: number;

	@Field()
	@IsDate()
	@Type(() => Date)
	updatedAt: Date;
}

@InputType('SavedPageInput')
export class SavedPageInput {
	@Field(() => ID)
	@IsUUID()
	bookId: string;

	@Field(() => ID)
	@IsUUID()
	chapterId: string;

	@Field()
	@IsInt()
	pageIndex: number;
}

@InputType('CommentInput')
export class CommentInput {
	@Field(() => ID)
	@IsUUID()
	chapterId: string;

	@Field(() => ID, { nullable: true })
	@IsOptional()
	@IsUUID()
	parentId?: string;

	@Field()
	@IsString()
	@IsNotEmpty()
	content: string;

	@Field({ nullable: true })
	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;
}

@InputType('SyncInput')
export class SyncInput {
	@Field({ nullable: true })
	@IsOptional()
	@IsDate()
	@Type(() => Date)
	lastSyncAt?: Date;

	@Field(() => [ReadingProgressInput], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ReadingProgressInput)
	readingProgress?: ReadingProgressInput[];

	@Field(() => [SavedPageInput], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SavedPageInput)
	savedPages?: SavedPageInput[];

	@Field(() => [CommentInput], { nullable: 'itemsAndList' })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CommentInput)
	comments?: CommentInput[];
}
