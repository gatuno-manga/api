import { IsUUID, IsInt, IsOptional, IsBoolean, Min, IsArray, ValidateNested, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class SaveReadingProgressDto {
	@IsUUID()
	chapterId: string;

	@IsUUID()
	bookId: string;

	@IsInt()
	@Min(0)
	pageIndex: number;

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
