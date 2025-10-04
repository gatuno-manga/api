import { Controller, Patch, Param, Body, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { TagsOptions } from './dto/tags-options.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';

@ApiTags('Tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
    constructor(private readonly tagsService: TagsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all tags', description: 'Retrieve a list of all tags with pagination' })
    @ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(OptionalAuthGuard)
    getAll(
        @Query() options: TagsOptions,
        @CurrentUser() user?: CurrentUserDto) {
        return this.tagsService.get(options, user?.maxWeightSensitiveContent);
    }

    @Patch(':tagId/merge')
    @ApiOperation({ summary: 'Merge tags', description: 'Merge multiple tags into one (Admin only)' })
    @ApiParam({ name: 'tagId', description: 'Target tag ID to merge into', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Tags merged successfully' })
    @ApiResponse({ status: 404, description: 'Tag not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    mergeTags(
        @Param('tagId') tagId: string,
        @Body() dto: string[],
    ) {
        return this.tagsService.mergeTags(tagId, dto);
    }
}
