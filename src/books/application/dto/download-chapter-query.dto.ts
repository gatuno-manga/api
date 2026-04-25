import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum ChapterDownloadFormat {
	ZIP = 'zip',
	PDF = 'pdf',
}

export class DownloadChapterQueryDto {
	@ApiPropertyOptional({
		description: 'Formato do download do capítulo',
		enum: ChapterDownloadFormat,
		default: ChapterDownloadFormat.ZIP,
	})
	@IsOptional()
	@IsEnum(ChapterDownloadFormat, {
		message: 'Format must be either "zip" or "pdf"',
	})
	format: ChapterDownloadFormat = ChapterDownloadFormat.ZIP;
}
