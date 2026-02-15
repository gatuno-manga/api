import { CacheTTL } from '@nestjs/cache-manager';
import {
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
import { Roles } from 'src/auth/decorator/roles.decorator';
import { CurrentUserDto } from 'src/auth/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { AuthorsService } from './authors.service';
import { AuthorsOptions } from './dto/authors-options.dto';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
	constructor(private readonly authorsService: AuthorsService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@ApiOperation({
		summary: 'Get all authors',
		description: 'Retrieve a list of all authors with pagination',
	})
	@ApiResponse({ status: 200, description: 'Authors retrieved successfully' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@UseGuards(OptionalAuthGuard)
	getAll(
		@Query() options: AuthorsOptions,
		@CurrentUser() user?: CurrentUserDto,
	) {
		return this.authorsService.getAll(
			options,
			user?.maxWeightSensitiveContent,
		);
	}

	@Patch(':authorId/merge')
	@Throttle({ medium: { limit: 10, ttl: 60000 } })
	@UseGuards(JwtAuthGuard)
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'Merge authors',
		description: 'Merge multiple authors into one (Admin only)',
	})
	@ApiParam({
		name: 'authorId',
		description: 'Target author ID to merge into',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Authors merged successfully' })
	@ApiResponse({ status: 404, description: 'Author not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	mergeAuthors(@Param('authorId') authorId: string, @Query() dto: string[]) {
		return this.authorsService.mergeAuthors(authorId, dto);
	}
}
