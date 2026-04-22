import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum ChapterDownloadFormat {
	ZIP = 'zip',
	PDF = 'pdf',
}

export class DownloadChapterQueryDto {
	@ApiProperty({
		description: 'Formato do download do capítulo',
		enum: ChapterDownloadFormat,
		example: ChapterDownloadFormat.ZIP,
	})
	@IsEnum(ChapterDownloadFormat, {
		message: 'Format must be either "zip" or "pdf"',
	})
	format: ChapterDownloadFormat;
}
