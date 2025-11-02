import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateChapterManualDto {
    @ApiPropertyOptional({
        description: 'Chapter title',
        example: 'Chapter 1: The Beginning',
        maxLength: 200,
    })
    @IsString()
    @IsOptional()
    @MaxLength(200)
    title?: string;

    @ApiPropertyOptional({
        description: 'Chapter order index',
        example: 1,
        minimum: 0,
    })
    @IsNumber()
    @IsPositive()
    @IsOptional()
    index?: number;
}
