import { IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuthorDto {
    @ApiProperty({
        description: 'Author name',
        example: 'J.K. Rowling',
        maxLength: 200,
    })
    @IsString()
    name: string;

    @ApiPropertyOptional({
        description: 'Author biography',
        example: 'British author, best known for the Harry Potter series',
        maxLength: 1000,
    })
    @IsString()
    @IsOptional()
    biography?: string;
}
