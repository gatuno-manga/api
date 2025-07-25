import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateSensitiveContentDto {
    @IsString()
    name: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    weight?: number;
}
