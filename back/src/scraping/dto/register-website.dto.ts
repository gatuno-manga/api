import { IsOptional, IsString, IsUrl, IsInt, IsBoolean, IsArray } from 'class-validator';
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
		description: 'CSS selector for chapter list on book page',
		example: '.chapter-list a',
	})
	@IsString()
	@IsOptional()
	chapterListSelector?: string;

	@ApiPropertyOptional({
		description: 'JavaScript code to extract chapter info. Should return array of {title, url, index}',
		example: `Array.from(document.querySelectorAll('.chapter-list a')).map((el, i) => ({ title: el.textContent, url: el.href, index: i + 1 }))`,
	})
	@IsString()
	@IsOptional()
	chapterExtractScript?: string;

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

	@ApiPropertyOptional({
		description: 'Blacklist terms: URLs containing these terms will be ignored',
		example: ['logo', 'icon', 'avatar', 'ads', 'banner', 'sprite', '.gif'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	blacklistTerms?: string[];

	@ApiPropertyOptional({
		description: 'Whitelist terms: If filled, only URLs containing these terms will be accepted',
		example: ['cdn.site.com', 'uploads/chapters'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	whitelistTerms?: string[];

	@ApiPropertyOptional({
		description: 'Enable network traffic interception for image caching (more efficient)',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	useNetworkInterception?: boolean;

	@ApiPropertyOptional({
		description: 'Use screenshot/print mode to capture images instead of downloading. Captures in PNG (lossless) for maximum quality. Useful for canvas-rendered images or sites with download protection.',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	useScreenshotMode?: boolean;
}
