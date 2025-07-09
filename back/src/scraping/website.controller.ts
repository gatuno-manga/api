import { Body, Controller, Post } from '@nestjs/common';
import { RegisterWebSiteDto } from './dto/register-website.dto';
import { WebsiteService } from './website.service';

@Controller('website')
export class WebsiteController {
	constructor(private readonly websiteService: WebsiteService) {}

	@Post()
	async registerWebsite(@Body() dto: RegisterWebSiteDto) {
		return this.websiteService.registerWebsite(dto);
	}
}
