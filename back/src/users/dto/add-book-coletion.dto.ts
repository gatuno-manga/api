import { IsString } from "class-validator";

export class addBookColetionDto {
    @IsString({ each: true })
    idsBook: string[];
}
