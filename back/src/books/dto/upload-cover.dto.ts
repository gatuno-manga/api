import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadCoverDto {
    @ApiPropertyOptional({
        description: 'Cover title or description',
        example: 'Main Cover',
        maxLength: 200,
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;
}
