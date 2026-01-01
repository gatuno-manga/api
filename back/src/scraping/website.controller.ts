import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UseGuards,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { WebsiteService } from './website.service';
import { UpdateWebsiteDto } from './dto/update-website.dto';

@ApiTags('Website Scraping')
@Controller('website')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WebsiteController {
	constructor(private readonly websiteService: WebsiteService) {}

	@Post()
	@Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'Register website for scraping',
		description:
			'Register a new website configuration for content scraping (Admin only)',
	})
	@ApiResponse({
		status: 201,
		description: 'Website registered successfully',
	})
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async registerWebsite(@Body() dto: RegisterWebSiteDto) {
		return this.websiteService.registerWebsite(dto);
	}

	@Get()
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'List all websites',
		description: 'Get all registered website configurations (Admin only)',
	})
	@ApiResponse({
		status: 200,
		description: 'List of websites returned successfully',
	})
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	async findAll() {
		return this.websiteService.findAll();
	}

	@Get(':id')
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'Get website by ID',
		description: 'Get a specific website configuration by ID (Admin only)',
	})
	@ApiParam({ name: 'id', description: 'Website UUID', type: 'string' })
	@ApiResponse({ status: 200, description: 'Website returned successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 404, description: 'Website not found' })
	async findOne(@Param('id', ParseUUIDPipe) id: string) {
		return this.websiteService.findOne(id);
	}

	@Patch(':id')
	@Throttle({ short: { limit: 10, ttl: 300000 } }) // 10 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'Update website',
		description: 'Update an existing website configuration (Admin only)',
	})
	@ApiParam({ name: 'id', description: 'Website UUID', type: 'string' })
	@ApiResponse({ status: 200, description: 'Website updated successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 404, description: 'Website not found' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async update(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() dto: UpdateWebsiteDto,
	) {
		return this.websiteService.update(id, dto);
	}

	@Delete(':id')
	@Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 req/5min
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({
		summary: 'Delete website',
		description: 'Delete a website configuration (Admin only)',
	})
	@ApiParam({ name: 'id', description: 'Website UUID', type: 'string' })
	@ApiResponse({ status: 200, description: 'Website deleted successfully' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({
		status: 403,
		description: 'Forbidden - Admin role required',
	})
	@ApiResponse({ status: 404, description: 'Website not found' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	async remove(@Param('id', ParseUUIDPipe) id: string) {
		await this.websiteService.remove(id);
		return { message: 'Website deleted successfully' };
	}
}
