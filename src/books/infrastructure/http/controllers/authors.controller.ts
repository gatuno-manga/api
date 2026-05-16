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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { Roles } from 'src/auth/infrastructure/framework/roles.decorator';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { RolesEnum } from 'src/users/domain/enums/roles.enum';
import { AuthorsService } from '@books/application/services/authors.service';
import { AuthorsOptions } from '@books/application/dto/authors-options.dto';
import { ApiDocsGetAll, ApiDocsMergeAuthors } from './swagger/authors.swagger';

@ApiTags('Authors')
@Controller('authors')
export class AuthorsController {
	constructor(private readonly authorsService: AuthorsService) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(1800)
	@UseGuards(OptionalAuthGuard)
	@ApiDocsGetAll()
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
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@ApiDocsMergeAuthors()
	mergeAuthors(@Param('authorId') authorId: string, @Query() dto: string[]) {
		return this.authorsService.mergeAuthors(authorId, dto);
	}
}
