import {
    IsArray,
    IsEnum,
    IsUUID,
    IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BookDownloadFormat {
    IMAGES_ZIP = 'images',
    PDFS_ZIP = 'pdfs',
}

export class DownloadBookBodyDto {
    @ApiPropertyOptional({
        description:
            'Lista de IDs dos capítulos para download. Se não fornecido, baixa todos os capítulos.',
        type: [String],
        example: [
            '550e8400-e29b-41d4-a716-446655440000',
            '550e8400-e29b-41d4-a716-446655440001',
        ],
    })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    chapterIds?: string[];

    @ApiProperty({
        description: 'Formato do download do livro',
        enum: BookDownloadFormat,
        example: BookDownloadFormat.IMAGES_ZIP,
    })
    @IsEnum(BookDownloadFormat, {
        message: 'Format must be either "images" or "pdfs"',
    })
    format: BookDownloadFormat;
}
