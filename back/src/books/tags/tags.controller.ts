import { Controller, Patch, Param, Body, Get, Query } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsOptions } from './dto/tags-options.dto';

@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) {}

    @Get()
    getAll(@Query() options: TagsOptions
    ) {
        return this.tagsService.getAll(options);
    }

    @Patch(':tagId/merge')
    mergeTags(
        @Param('tagId') tagId: string,
        @Body() dto: string[],
    ) {
        return this.tagsService.mergeTags(tagId, dto);
    }
}
