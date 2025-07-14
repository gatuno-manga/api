import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ChapterService } from './chapter.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';

@Controller('chapters')
export class ChapterController {
    constructor(private readonly chapterService: ChapterService) {}

    @Get(':idChapter')
    getChapter(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user?: CurrentUserDto
    ) {
        return this.chapterService.getChapter(idChapter, user?.userId);
    }

    @Patch('/:idChapter/reset')
    resetChapter(
        @Param('idChapter') idChapter: string,
    ) {
        return this.chapterService.resetChapter(idChapter);
    }

    @Get('/:idChapter/read/')
    @UseGuards(JwtAuthGuard)
    markChapterAsRead(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user: CurrentUserDto
    ) {
        return this.chapterService.markChapterAsRead(idChapter, user.userId);
    }
}
