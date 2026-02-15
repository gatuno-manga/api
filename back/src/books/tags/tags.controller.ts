import { CacheTTL } from '@nestjs/cache-manager';
import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Query,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiResponse,
	ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/decorator/current-user.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { TagsOptions } from './dto/tags-options.dto';
import { TagsService } from './tags.service';

@ApiTags('Tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
	constructor(private readonly tagsService: TagsService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
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
