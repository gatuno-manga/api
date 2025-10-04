import { IsArray, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuthorsOptions {
    @ApiPropertyOptional({
        description: 'Filter authors by sensitive content in their books',
        example: ['violence', 'gore'],
        type: [String],
        isArray: true,
    })
    @IsOptional()
    @IsArray()
    sensitiveContent?: string[] = [];
}
