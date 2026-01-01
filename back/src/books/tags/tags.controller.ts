import {
	Controller,
	Patch,
	Param,
	Body,
	Get,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiParam,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { Throttle } from '@nestjs/throttler';
import { TagsService } from './tags.service';
import { TagsOptions } from './dto/tags-options.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';

@ApiTags('Tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
	constructor(private readonly tagsService: TagsService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(1800)
	@ApiOperation({
		summary: 'Get all tags',
		description: 'Retrieve a list of all tags with pagination',
	})
	@ApiResponse({ status: 200, description: 'Tags retrieved successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(OptionalAuthGuard)
	getAll(
		@Query() options: TagsOptions,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.tagsService.get(options, user?.maxWeightSensitiveContent);
	}

	@Patch(':tagId/merge')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@ApiOperation({
		summary: 'Merge tags',
		description: 'Merge multiple tags into one (Admin only)',
	})
	@ApiParam({
		name: 'tagId',
		description: 'Target tag ID to merge into',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Tags merged successfully' })
	@ApiResponse({ status: 404, description: 'Tag not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	mergeTags(@Param('tagId') tagId: string, @Body() dto: string[]) {
		return this.tagsService.mergeTags(tagId, dto);
	}
}
