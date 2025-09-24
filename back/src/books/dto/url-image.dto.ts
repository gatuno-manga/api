import { Transform } from "class-transformer";
import { IsString, IsUrl } from "class-validator";

export class UrlImageDto {

    @Transform(({ value, obj }) => {
        return value;
    })
    @IsUrl()
    url: string;

    @IsString()
    title: string;
}
