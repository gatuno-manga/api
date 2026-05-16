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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { TagsOptions } from '@books/application/dto/tags-options.dto';
import { TagsService } from '@books/application/services/tags.service';
import { ApiDocsGetAll, ApiDocsMergeTags } from './swagger/tags.swagger';

@ApiTags('Tags')
@Controller('tags')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
export class TagsController {
	constructor(private readonly tagsService: TagsService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@UseGuards(OptionalAuthGuard)
	@ApiDocsGetAll()
	getAll(
		@Query() options: TagsOptions,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.tagsService.get(options, user?.maxWeightSensitiveContent);
	}

	@Patch(':tagId/merge')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@ApiDocsMergeTags()
	mergeTags(@Param('tagId') tagId: string, @Body() dto: string[]) {
		return this.tagsService.mergeTags(tagId, dto);
	}
}
