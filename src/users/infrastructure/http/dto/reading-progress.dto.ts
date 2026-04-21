import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsDate,
	IsInt,
	IsOptional,
	IsUUID,
	ArrayMaxSize,
	ArrayMinSize,
	Min,
	ValidateNested,
} from 'class-validator';

export class SaveReadingProgressDto {
	@IsUUID('4')
	chapterId: string;

	@IsUUID('4')
	bookId: string;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	pageIndex: number;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@IsOptional()
	totalPages?: number;

	@IsBoolean()
	@IsOptional()
	completed?: boolean;
}

export class ReadingProgressResponseDto {
	id: string;
	chapterId: string;
	bookId: string;
	pageIndex: number;
	totalPages: number;
	completed: boolean;
	updatedAt: Date;
}

export class SyncReadingProgressDto {
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(500)
	@ValidateNested({ each: true })
	@Type(() => SaveReadingProgressDto)
	progress: SaveReadingProgressDto[];

	@IsOptional()
	@IsDate()
	@Type(() => Date)
	lastSyncAt?: Date;
}

export class SyncResponseDto {
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => ReadingProgressResponseDto)
	synced: ReadingProgressResponseDto[];

	@IsArray()
	conflicts: Array<{
		local: SaveReadingProgressDto;
		remote: ReadingProgressResponseDto;
	}>;

	@IsDate()
	@Type(() => Date)
	lastSyncAt: Date;
}

export class BulkReadingProgressDto {
	bookId: string;
	progress: ReadingProgressResponseDto[];
}
