import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ChapterService } from './chapter.service';

@Controller('chapters')
export class ChapterController {
    constructor(private readonly chapterService: ChapterService) {}

    @Get(':idChapter')
    getChapter(
        @Param('idChapter') idChapter: string,
    ) {
        return this.chapterService.getChapter(idChapter);
    }

    @Patch('/:idChapter/reset')
    resetChapter(
        @Param('idChapter') idChapter: string,
    ) {
        return this.chapterService.resetChapter(idChapter);
    }
}
