import { CreateSensitiveContentDto } from '@books/application/dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from '@books/application/dto/update-sensitive-content.dto';
import { SensitiveContentService } from '@books/application/services/sensitive-content.service';
import { CacheTTL } from '@nestjs/cache-manager';
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Put,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { CurrentUser } from 'src/auth/infrastructure/framework/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/infrastructure/framework/jwt-auth.guard';
import { OptionalAuthGuard } from 'src/auth/infrastructure/framework/optional-auth.guard';
import { UserAwareCacheInterceptor } from 'src/common/interceptors/user-aware-cache.interceptor';
import { SWAGGER_AUTH_SCHEME } from 'src/common/swagger/swagger-auth.constants';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { Permissions } from 'src/users/domain/decorators/permissions.decorator';
import { PermissionsEnum } from 'src/users/domain/enums/permissions.enum';
import {
	ApiDocsCreate,
	ApiDocsGetAll,
	ApiDocsGetOne,
	ApiDocsMergeSensitiveContent,
	ApiDocsRemove,
	ApiDocsUpdate,
} from './swagger/sensitive-content.swagger';

@ApiTags('Sensitive Content')
@Controller('sensitive-content')
export class SensitiveContentController {
	constructor(
		private readonly sensitiveContentService: SensitiveContentService,
	) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(3600)
	@UseGuards(OptionalAuthGuard)
	@ApiDocsGetAll()
	getAll(@CurrentUser() user?: CurrentUserDto) {
		return this.sensitiveContentService.getAll(
			user?.maxWeightSensitiveContent,
		);
	}

	@Get(':id')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(UserAwareCacheInterceptor)
	@CacheTTL(3600)
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.SENSITIVE_CONTENT_VIEW)
	@ApiDocsGetOne()
	getOne(@Param('id') id: string) {
		return this.sensitiveContentService.getOne(id);
	}

	@Post()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.SENSITIVE_CONTENT_MANAGE)
	@ApiDocsCreate()
	create(@Body() dto: CreateSensitiveContentDto) {
		return this.sensitiveContentService.create(dto);
	}

	@Put(':id')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.SENSITIVE_CONTENT_MANAGE)
	@ApiDocsUpdate()
	update(@Param('id') id: string, @Body() dto: UpdateSensitiveContentDto) {
		return this.sensitiveContentService.update(id, dto);
	}

	@Delete(':id')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.SENSITIVE_CONTENT_MANAGE)
	@ApiDocsRemove()
	remove(@Param('id') id: string) {
		return this.sensitiveContentService.remove(id);
	}

	@Patch(':contentId/merge')
	@ApiBearerAuth(SWAGGER_AUTH_SCHEME)
	@UseGuards(JwtAuthGuard, PermissionsGuard)
	@Permissions(PermissionsEnum.SENSITIVE_CONTENT_MANAGE)
	@ApiDocsMergeSensitiveContent()
	mergeSensitiveContent(
		@Param('contentId') contentId: string,
		@Body() dto: string[],
	) {
		return this.sensitiveContentService.mergeSensitiveContent(
			contentId,
			dto,
		);
	}
}
