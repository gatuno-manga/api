import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSensitiveContentDto {
    @ApiPropertyOptional({
        description: 'Sensitive content name/label',
        example: 'Violence',
        maxLength: 100,
    })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({
        description: 'Severity weight of the content (0-10)',
        example: 5,
        minimum: 0,
    })
    @IsInt()
    @Min(0)
    @IsOptional()
    weight?: number;
}
