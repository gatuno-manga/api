import { IsOptional, IsString } from "class-validator";

export class CreateAuthorDto {
    @IsString()
    name: string;

    @IsString()
    @IsOptional()
    biography?: string;
}
