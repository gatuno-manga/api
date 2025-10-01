import { IsArray, IsOptional } from 'class-validator';

export class AuthorsOptions {
    @IsOptional()
    @IsArray()
    sensitiveContent?: string[] = [];
}
