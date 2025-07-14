import { IsOptional, IsString } from "class-validator";

export class CreateColetionBookDto {

    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
}
