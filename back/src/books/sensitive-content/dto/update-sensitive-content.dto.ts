import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSensitiveContentDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    weight?: number;
}
