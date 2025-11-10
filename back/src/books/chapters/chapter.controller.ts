import { Body, Controller, Get, Param, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { ChapterService } from './chapter.service';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';

@ApiTags('Chapters')
@Controller('chapters')
export class ChapterController {
    constructor(private readonly chapterService: ChapterService) {}

    @Get(':idChapter')
    @Throttle({ long: { limit: 200, ttl: 60000 } })
    @UseInterceptors(CacheInterceptor)
    @CacheTTL(600)
    @ApiOperation({ summary: 'Get chapter by ID', description: 'Retrieve chapter content and details' })
    @ApiParam({ name: 'idChapter', description: 'Chapter unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Chapter found' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 429, description: 'Too many requests' })
    @UseGuards(OptionalAuthGuard)
    getChapter(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user?: CurrentUserDto
    ) {
        return this.chapterService.getChapter(idChapter, user?.userId);
    }

    @Patch(':idChapter/reset/')
    @ApiOperation({ summary: 'Reset chapter', description: 'Reset chapter cache and data' })
    @ApiParam({ name: 'idChapter', description: 'Chapter unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Chapter reset successfully' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    resetChapter(
        @Param('idChapter') idChapter: string,
    ) {
        return this.chapterService.resetChapter(idChapter);
    }

    @Patch('/reset')
    @ApiOperation({ summary: 'Reset multiple chapters', description: 'Reset cache and data for multiple chapters' })
    @ApiResponse({ status: 200, description: 'Chapters reset successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    resetAllChapters(
        @Body() body: string[]
    ) {
        return this.chapterService.resetAllChapters(body);
    }


    @Get('/:idChapter/read/')
    @Throttle({ medium: { limit: 50, ttl: 60000 } })
    @ApiOperation({ summary: 'Mark chapter as read', description: 'Mark a chapter as read for the current user' })
    @ApiParam({ name: 'idChapter', description: 'Chapter unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Chapter marked as read' })
    @ApiResponse({ status: 404, description: 'Chapter not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 429, description: 'Too many requests' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    markChapterAsRead(
        @Param('idChapter') idChapter: string,
        @CurrentUser() user: CurrentUserDto
    ) {
        return this.chapterService.markChapterAsRead(idChapter, user.userId);
    }

    @Get('less-pages/:pages')
    @ApiOperation({ summary: 'Get chapters with few pages', description: 'List chapters with less than specified number of pages' })
    @ApiParam({ name: 'pages', description: 'Maximum number of pages', example: 10 })
    @ApiResponse({ status: 200, description: 'Chapters retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(JwtAuthGuard)
    getChaptersWithLessPages(
        @Param('pages') pages: number,
    ) {
        return this.chapterService.listLessPages(pages);
    }
}
