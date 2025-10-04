import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { WebsiteService } from './website.service';

@ApiTags('Website Scraping')
@Controller('website')
export class WebsiteController {
	constructor(private readonly websiteService: WebsiteService) {}

	@Post()
	@ApiOperation({ summary: 'Register website for scraping', description: 'Register a new website configuration for content scraping' })
	@ApiResponse({ status: 201, description: 'Website registered successfully' })
	@ApiResponse({ status: 400, description: 'Invalid input data' })
	async registerWebsite(@Body() dto: RegisterWebSiteDto) {
		return this.websiteService.registerWebsite(dto);
	}
}
