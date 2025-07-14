import { IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
    @IsString()
    @IsOptional()
    userName: string;

    @IsString()
    @IsOptional()
    name: string;
}
