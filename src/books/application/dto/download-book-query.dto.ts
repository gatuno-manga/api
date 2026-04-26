import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { BookDownloadFormat } from './download-book-body.dto';

export class DownloadBookQueryDto {
	@ApiPropertyOptional({
		description:
			'Lista de IDs dos capítulos para download. Se não fornecido, baixa todos os capítulos.',
		type: [String],
	})
	@IsOptional()
	@IsArray()
	@IsUUID('4', { each: true })
	@Transform(({ value }) => {
		if (typeof value === 'string') {
			return value.split(',');
		}
		return value;
	})
	chapterIds?: string[];

	@ApiPropertyOptional({
		description: 'Formato do download do livro',
		enum: BookDownloadFormat,
		default: BookDownloadFormat.IMAGES_ZIP,
	})
	@IsOptional()
	@IsEnum(BookDownloadFormat)
	format: BookDownloadFormat = BookDownloadFormat.IMAGES_ZIP;
}
