import { Controller, Patch, Param, Body, Get, Query, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsOptions } from './dto/tags-options.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
    constructor(private readonly tagsService: TagsService) {}

    @Get()
    @UseGuards(OptionalAuthGuard)
    getAll(
        @Query() options: TagsOptions,
        @CurrentUser() user?: CurrentUserDto) {
        return this.tagsService.get(options, user?.maxWeightSensitiveContent);
    }

    @Patch(':tagId/merge')
    mergeTags(
        @Param('tagId') tagId: string,
        @Body() dto: string[],
    ) {
        return this.tagsService.mergeTags(tagId, dto);
    }
}
