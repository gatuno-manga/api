import { IsOptional, IsString } from "class-validator";

export class CreateCollectionBookDto {
    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;
}
