import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsArray,
	IsBoolean,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	Min,
} from 'class-validator';
import { CookieConfig } from '../helpers/storage-injector';

export class WebsiteConfigDto {
	@ApiProperty({
		description: 'CSS selector used to extract chapter content',
		example: '.chapter-content img',
	})
	@IsString()
	selector: string;

	@ApiProperty({
		description: 'Script executed before scraping process',
		example: 'window.scrollTo(0, document.body.scrollHeight);',
	})
	@IsString()
	preScript: string;

	@ApiProperty({
		description: 'Script executed after scraping process',
		example: 'console.log("done")',
	})
	@IsString()
	posScript: string;

	@ApiPropertyOptional({
		description: 'Maximum concurrent scraping jobs for this website',
		example: 3,
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	concurrencyLimit?: number | null;

	@ApiProperty({
		description: 'Blacklist terms to ignore assets',
		type: [String],
		example: ['logo', 'banner'],
	})
	@IsArray()
	@IsString({ each: true })
	blacklistTerms: string[];

	@ApiProperty({
		description: 'Whitelist terms to accept assets',
		type: [String],
		example: ['cdn.site.com', 'chapter'],
	})
	@IsArray()
	@IsString({ each: true })
	whitelistTerms: string[];

	@ApiProperty({
		description: 'Enable network interception mode',
		example: true,
	})
	@IsBoolean()
	useNetworkInterception: boolean;

	@ApiProperty({
		description: 'Enable screenshot extraction mode',
		example: false,
	})
	@IsBoolean()
	useScreenshotMode: boolean;

	@ApiPropertyOptional({
		description: 'Selector for chapter list links',
		example: '.chapter-list a',
	})
	@IsOptional()
	@IsString()
	chapterListSelector?: string;

	@ApiPropertyOptional({
		description: 'Script to extract book metadata and chapter list',
		example: '(() => ({ covers: [], chapters: [] }))()',
	})
	@IsOptional()
	@IsString()
	bookInfoExtractScript?: string;
	/** Cookies to inject before navigation */
	@ApiPropertyOptional({
		description: 'Cookies injected before navigation',
		type: [Object],
	})
	@IsOptional()
	@IsArray()
	cookies?: CookieConfig[];
	/** localStorage items to inject after page load */
	@ApiPropertyOptional({
		description: 'localStorage key-value entries to inject',
		type: Object,
	})
	@IsOptional()
	@IsObject()
	localStorage?: Record<string, string>;
	/** sessionStorage items to inject after page load */
	@ApiPropertyOptional({
		description: 'sessionStorage key-value entries to inject',
		type: Object,
	})
	@IsOptional()
	@IsObject()
	sessionStorage?: Record<string, string>;
	/** Whether to reload the page after injecting storage */
	@ApiPropertyOptional({
		description: 'Whether page should be reloaded after storage injection',
		example: false,
	})
	@IsOptional()
	@IsBoolean()
	reloadAfterStorageInjection?: boolean;
	/** Enable adaptive timeouts based on page size */
	@ApiPropertyOptional({
		description: 'Enable adaptive timeout strategy by page size',
		example: true,
	})
	@IsOptional()
	@IsBoolean()
	enableAdaptiveTimeouts?: boolean;
	/** Custom timeout multipliers by page size */
	@ApiPropertyOptional({
		description: 'Timeout multipliers by page size buckets',
		type: Object,
		example: { small: 1, medium: 1.5, large: 2 },
	})
	@IsOptional()
	@IsObject()
	timeoutMultipliers?: Record<string, number>;
}
