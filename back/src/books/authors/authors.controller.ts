import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { OptionalAuthGuard } from "src/auth/guard/optional-auth.guard";
import { AuthorsService } from "./authors.service";
import { AuthorsOptions } from "./dto/authors-options.dto";
import { CurrentUserDto } from "src/auth/dto/current-user.dto";
import { CurrentUser } from "src/auth/decorator/current-user.decorator";

@Controller('authors')
export class AuthorsController {
    constructor(private readonly authorsService: AuthorsService) {}

    @Get()
    @UseGuards(OptionalAuthGuard)
    getAll(
        @Query() options: AuthorsOptions,
        @CurrentUser() user?: CurrentUserDto) {
        return this.authorsService.getAll(options, user?.maxWeightSensitiveContent);
    }

    @Patch(':authorId/merge')
    mergeAuthors(
        @Param('authorId') authorId: string,
        @Query() dto: string[],
    ) {
        return this.authorsService.mergeAuthors(authorId, dto);
    }
}
