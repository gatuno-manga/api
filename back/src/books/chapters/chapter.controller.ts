import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';

@Controller('chapters')
export class ChapterController {
    constructor(private readonly chapterService: ChapterService) {}

    @Get(':idChapter')
    @UseGuards(OptionalAuthGuard)
    getChapter(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user?: CurrentUserDto
    ) {
        return this.chapterService.getChapter(idChapter, user?.userId);
    }

    @Patch('/reset/:idChapter')
    resetChapter(
        @Param('idChapter') idChapter: string,
    ) {
        return this.chapterService.resetChapter(idChapter);
    }

    @Patch('/reset')
    resetAllChapters(
        @Body() body: string[]
    ) {
        return this.chapterService.resetAllChapters(body);
    }


    @Get('/:idChapter/read/')
    @UseGuards(JwtAuthGuard)
    markChapterAsRead(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user: CurrentUserDto
    ) {
        return this.chapterService.markChapterAsRead(idChapter, user.userId);
    }

    @Get('less-pages/:pages')
    @UseGuards(JwtAuthGuard)
    getChaptersWithLessPages(
        @Param('pages') pages: number,
    ) {
        return this.chapterService.listLessPages(pages);
    }
}
