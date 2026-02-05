import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ContentFormat } from '../enum/content-format.enum';

/**
 * DTO para upload de conteúdo textual de um capítulo
 * Usado quando Chapter.contentType = TEXT
 */
export class UploadTextContentDto {
    @ApiProperty({
        description: 'Conteúdo textual do capítulo',
        example: '# Capítulo 1\n\nEra uma vez em uma terra distante...',
        maxLength: 500000, // ~500KB de texto
    })
    @IsString()
    @IsNotEmpty({ message: 'O conteúdo não pode estar vazio' })
    @MaxLength(500000, { message: 'O conteúdo excede o limite de 500KB' })
    content: string;

    @ApiProperty({
        description: 'Formato do conteúdo textual',
        enum: ContentFormat,
        example: ContentFormat.MARKDOWN,
    })
    @IsEnum(ContentFormat, {
        message: 'Formato deve ser: markdown, html ou plain',
    })
    @IsNotEmpty()
    format: ContentFormat;
}
