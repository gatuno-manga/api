import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { OptionalAuthGuard } from "src/auth/guard/optional-auth.guard";
import { AuthorsService } from "./authors.service";
import { AuthorsOptions } from "./dto/authors-options.dto";
import { CurrentUserDto } from "src/auth/dto/current-user.dto";
import { CurrentUser } from "src/auth/decorator/current-user.decorator";

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
    constructor(private readonly authorsService: AuthorsService) {}

    @Get()
    @ApiOperation({ summary: 'Get all authors', description: 'Retrieve a list of all authors with pagination' })
    @ApiResponse({ status: 200, description: 'Authors retrieved successfully' })
    @UseGuards(OptionalAuthGuard)
    getAll(
        @Query() options: AuthorsOptions,
        @CurrentUser() user?: CurrentUserDto) {
        return this.authorsService.getAll(options, user?.maxWeightSensitiveContent);
    }

    @Patch(':authorId/merge')
    @ApiOperation({ summary: 'Merge authors', description: 'Merge multiple authors into one (Admin only)' })
    @ApiParam({ name: 'authorId', description: 'Target author ID to merge into', example: '550e8400-e29b-41d4-a716-446655440000' })
    @ApiResponse({ status: 200, description: 'Authors merged successfully' })
    @ApiResponse({ status: 404, description: 'Author not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiBearerAuth('JWT-auth')
    mergeAuthors(
        @Param('authorId') authorId: string,
        @Query() dto: string[],
    ) {
        return this.authorsService.mergeAuthors(authorId, dto);
    }
}
