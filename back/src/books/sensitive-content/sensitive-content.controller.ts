import { Controller, Patch, Param, Body, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { SensitiveContentService } from './sensitive-content.service';
import { CreateSensitiveContentDto } from './dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from './dto/update-sensitive-content.dto';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';

@Controller('sensitive-content')
export class SensitiveContentController {
    constructor(private readonly sensitiveContentService: SensitiveContentService) {}

    @Get()
    @UseGuards(OptionalAuthGuard)
    getAll(
        @CurrentUser() user?: CurrentUserDto
    ) {
        return this.sensitiveContentService.getAll(user?.maxWeightSensitiveContent);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    getOne(@Param('id') id: string) {
        return this.sensitiveContentService.getOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Body() dto: CreateSensitiveContentDto) {
        return this.sensitiveContentService.create(dto);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    update(@Param('id') id: string, @Body() dto: UpdateSensitiveContentDto) {
        return this.sensitiveContentService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    remove(@Param('id') id: string) {
        return this.sensitiveContentService.remove(id);
    }

    @Patch(':contentId/merge')
    @UseGuards(JwtAuthGuard)
    mergeSensitiveContent(
        @Param('contentId') contentId: string,
        @Body() dto: string[],
    ) {
        return this.sensitiveContentService.mergeSensitiveContent(contentId, dto);
    }
}
