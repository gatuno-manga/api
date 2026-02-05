import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentFormat } from '../enum/document-format.enum';

/**
 * DTO para upload de documento (PDF/EPUB)
 * Usado quando Chapter.contentType = DOCUMENT
 *
 * Nota: O arquivo é validado via FileInterceptor no controller
 * Este DTO é para metadados opcionais
 */
export class UploadDocumentDto {
    @ApiProperty({
        description: 'Título alternativo para o documento',
        example: 'Capítulo 1 - Versão Revisada',
        required: false,
    })
    @IsString()
    @IsOptional()
    title?: string;

    @ApiProperty({
        description: 'Formato do documento (detectado automaticamente se não fornecido)',
        enum: DocumentFormat,
        example: DocumentFormat.PDF,
        required: false,
    })
    @IsEnum(DocumentFormat)
    @IsOptional()
    format?: DocumentFormat;
}