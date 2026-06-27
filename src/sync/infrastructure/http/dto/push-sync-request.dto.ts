import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { CreateSavedPageDto } from '@users/infrastructure/http/dto/create-saved-page.dto';
import { SaveReadingProgressDto } from '@users/infrastructure/http/dto/reading-progress.dto';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsDateString,
	IsNotEmpty,
	IsOptional,
	IsUUID,
	ValidateNested,
} from 'class-validator';
import { CreateCollectionDto } from 'src/collections/infrastructure/http/dto/create-collection.dto';
import { SyncFeature } from '../../../application/types/sync-feature.enum';
import { SyncCommentDto } from './sync-request.dto';

export class SyncFavoriteDto {
	@ApiProperty({ description: 'ID do livro favoritado' })
	@IsUUID()
	@IsNotEmpty()
	bookId: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	deletedAt?: string;
}

export class SyncSavedPageDto extends CreateSavedPageDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	deletedAt?: string;
}

export class SyncCollectionDto extends OmitType(CreateCollectionDto, [
	'id',
] as const) {
	@ApiProperty({ description: 'Required UUID for sync mapping' })
	@IsUUID()
	@IsNotEmpty()
	id: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	deletedAt?: string;
}

export class PushSyncRequestDto {
	@ApiPropertyOptional({ type: [SaveReadingProgressDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SaveReadingProgressDto)
	[SyncFeature.READING_PROGRESS]?: SaveReadingProgressDto[];

	@ApiPropertyOptional({ type: [SyncSavedPageDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncSavedPageDto)
	[SyncFeature.SAVED_PAGES]?: SyncSavedPageDto[];

	@ApiPropertyOptional({ type: [SyncCommentDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncCommentDto)
	[SyncFeature.COMMENTS]?: SyncCommentDto[];

	@ApiPropertyOptional({ type: [SyncFavoriteDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncFavoriteDto)
	[SyncFeature.FAVORITES]?: SyncFavoriteDto[];

	@ApiPropertyOptional({ type: [SyncCollectionDto] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SyncCollectionDto)
	[SyncFeature.COLLECTIONS]?: SyncCollectionDto[];
}
