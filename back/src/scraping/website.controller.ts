import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/enum/roles.enum';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { WebsiteService } from './website.service';

@ApiTags('Website Scraping')
@Controller('website')
export class WebsiteController {
	constructor(private readonly websiteService: WebsiteService) {}

	@Post()
	@Throttle({ short: { limit: 5, ttl: 300000 } }) // 5 req/5min
	@UseGuards(JwtAuthGuard)
	@Roles(RolesEnum.ADMIN)
	@ApiOperation({ summary: 'Register website for scraping', description: 'Register a new website configuration for content scraping (Admin only)' })
	@ApiResponse({ status: 201, description: 'Website registered successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	@ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
	@ApiResponse({ status: 429, description: 'Too many requests' })
	@ApiBearerAuth('JWT-auth')
	async registerWebsite(@Body() dto: RegisterWebSiteDto) {
		return this.websiteService.registerWebsite(dto);
	}
}
