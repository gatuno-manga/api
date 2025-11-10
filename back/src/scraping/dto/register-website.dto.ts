import { IsOptional, IsString, IsUrl, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterWebSiteDto {
	@ApiProperty({
		description: 'Website URL to scrape',
		example: 'https://example.com/manga',
		format: 'url',
	})
	@IsUrl()
	url: string;

	@ApiPropertyOptional({
		description: 'Script to execute before scraping',
		example: 'window.scrollTo(0, document.body.scrollHeight);',
	})
	@IsString()
	@IsOptional()
	preScript?: string;

	@ApiPropertyOptional({
		description: 'Script to execute after scraping',
		example: 'console.log("Scraping completed");',
	})
	@IsString()
	@IsOptional()
	posScript?: string;

	@ApiProperty({
		description: 'CSS selector for content extraction',
		example: '.manga-content img',
	})
	@IsString()
	selector: string;

	@ApiPropertyOptional({
		description: 'Array of file patterns to ignore during scraping',
		example: ['ads.jpg', 'banner.png'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsString({ each: true })
	ignoreFiles?: string[];

	@ApiPropertyOptional({
		description: 'Optional concurrency limit for simultaneous scrapes of this site. Null or omitted = unlimited',
		example: 3,
	})
	@IsOptional()
	@IsInt()
	concurrencyLimit?: number;
}
