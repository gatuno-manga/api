import { IsArray, IsString } from "class-validator";

export class AddBookCollectionDto {
    @IsArray()
    idsBook: string[];
}
