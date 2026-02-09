import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
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
import { CreateSensitiveContentDto } from './dto/create-sensitive-content.dto';
import { UpdateSensitiveContentDto } from './dto/update-sensitive-content.dto';
import { SensitiveContentService } from './sensitive-content.service';

@ApiTags('Sensitive Content')
@Controller('sensitive-content')
export class SensitiveContentController {
	constructor(
		private readonly sensitiveContentService: SensitiveContentService,
	) {}

	@Get()
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(3600)
	@ApiOperation({
		summary: 'Get all sensitive content tags',
		description: 'Retrieve all available sensitive content categories',
	})
	@ApiResponse({
		status: 200,
		description: 'Sensitive content tags retrieved successfully',
	})
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@UseGuards(OptionalAuthGuard)
	getAll(@CurrentUser() user?: CurrentUserDto) {
		return this.sensitiveContentService.getAll(
			user?.maxWeightSensitiveContent,
		);
	}

	@Get(':id')
	@Throttle({ long: { limit: 100, ttl: 60000 } })
	@UseInterceptors(CacheInterceptor)
	@CacheTTL(3600)
	@ApiOperation({
		summary: 'Get sensitive content by ID',
		description: 'Retrieve details of a specific sensitive content tag',
	})
	@ApiParam({
		name: 'id',
		description: 'Sensitive content unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({ status: 200, description: 'Sensitive content found' })
	@ApiResponse({ status: 404, description: 'Sensitive content not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	getOne(@Param('id') id: string) {
		return this.sensitiveContentService.getOne(id);
	}

	@Post()
	@Throttle({ medium: { limit: 20, ttl: 60000 } })
	@ApiOperation({
		summary: 'Create sensitive content tag',
		description: 'Create a new sensitive content category (Admin only)',
	})
	@ApiResponse({
		status: 201,
		description: 'Sensitive content created successfully',
	})
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	create(@Body() dto: CreateSensitiveContentDto) {
		return this.sensitiveContentService.create(dto);
	}

	@Put(':id')
	@ApiOperation({
		summary: 'Update sensitive content tag',
		description: 'Update a sensitive content category (Admin only)',
	})
	@ApiParam({
		name: 'id',
		description: 'Sensitive content unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Sensitive content updated successfully',
	})
	@ApiResponse({ status: 404, description: 'Sensitive content not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	update(@Param('id') id: string, @Body() dto: UpdateSensitiveContentDto) {
		return this.sensitiveContentService.update(id, dto);
	}

	@Delete(':id')
	@ApiOperation({
		summary: 'Delete sensitive content tag',
		description: 'Remove a sensitive content category (Admin only)',
	})
	@ApiParam({
		name: 'id',
		description: 'Sensitive content unique identifier',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Sensitive content deleted successfully',
	})
	@ApiResponse({ status: 404, description: 'Sensitive content not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	remove(@Param('id') id: string) {
		return this.sensitiveContentService.remove(id);
	}

	@Patch(':contentId/merge')
	@ApiOperation({
		summary: 'Merge sensitive content tags',
		description:
			'Merge multiple sensitive content tags into one (Admin only)',
	})
	@ApiParam({
		name: 'contentId',
		description: 'Target sensitive content ID to merge into',
		example: '550e8400-e29b-41d4-a716-446655440000',
	})
	@ApiResponse({
		status: 200,
		description: 'Sensitive content tags merged successfully',
	})
	@ApiResponse({ status: 404, description: 'Sensitive content not found' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
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
