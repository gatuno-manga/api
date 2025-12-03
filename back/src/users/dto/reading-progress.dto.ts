import { IsUUID, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

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
    progress: SaveReadingProgressDto[];
    lastSyncAt?: Date;
}

export class SyncResponseDto {
    synced: ReadingProgressResponseDto[];
    conflicts: Array<{
        local: SaveReadingProgressDto;
        remote: ReadingProgressResponseDto;
    }>;
    lastSyncAt: Date;
}

export class BulkReadingProgressDto {
    bookId: string;
    progress: ReadingProgressResponseDto[];
}
