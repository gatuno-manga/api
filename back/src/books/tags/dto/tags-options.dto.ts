import { IsOptional } from "class-validator";
import { ToArray } from "src/pages/decorator/to-array.decorator";

export class TagsOptions {
    @IsOptional()
    @ToArray()
    sensitiveContent?: string[] = [];
}
