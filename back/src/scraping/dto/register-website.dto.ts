import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUrl,
	ValidateNested,
} from 'class-validator';
import { NormalizeUrl } from '../../common/decorators/normalize-url.decorator';

export class CookieConfigDto {
	@ApiProperty({ description: 'Cookie name', example: 'lang' })
	@IsString()
	name: string;

	@ApiProperty({ description: 'Cookie value', example: 'en' })
	@IsString()
	value: string;

	@ApiPropertyOptional({
		description: 'Domain for the cookie. If omitted, uses the page domain',
		example: '.example.com',
	})
	@IsOptional()
	@IsString()
	domain?: string;

	@ApiPropertyOptional({
		description: 'Path for the cookie',
		example: '/',
		default: '/',
	})
	@IsOptional()
	@IsString()
	path?: string;

	@ApiPropertyOptional({
		description: 'Whether the cookie is secure (HTTPS only)',
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	secure?: boolean;

	@ApiPropertyOptional({
		description: 'Whether the cookie is HTTP-only',
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	httpOnly?: boolean;

	@ApiPropertyOptional({
		description: 'SameSite attribute',
		enum: ['Strict', 'Lax', 'None'],
		default: 'Lax',
	})
	@IsOptional()
	@IsString()
	sameSite?: 'Strict' | 'Lax' | 'None';

	@ApiPropertyOptional({
		description: 'Expiration as Unix timestamp in seconds',
		example: 'Math.floor(Date.now() / 1000) + 86400 * 365',
	})
	@IsOptional()
	@IsInt()
	expires?: number;
}

export class RegisterWebSiteDto {
	@ApiProperty({
		description: 'Website URL to scrape',
		example: 'https://example.com/manga',
		format: 'url',
	})
	@NormalizeUrl()
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
		description: `JavaScript code to extract all book info at once. Should return an object with:
- covers: array of {url, title?} (capas do livro)
- chapters: array of {title, url, index, isFinal?}

Example output:
{
  covers: [
    { url: "https://site.com/cover1.jpg", title: "Capa Volume 1" },
    { url: "https://site.com/cover2.jpg", title: "Capa Alternativa" }
  ],
  chapters: [
    { title: "Cap 1", url: "https://...", index: 1, isFinal: false },
    { title: "Cap Final", url: "https://...", index: 100, isFinal: true }
  ]
}`,
		example: `(() => {
  const coverElements = document.querySelectorAll('.book-cover img, .gallery-thumb img');
  const covers = Array.from(coverElements).map((img, i) => ({
    url: img.src,
    title: img.alt || img.title || 'Capa ' + (i + 1)
  })).filter(c => c.url);

  if (covers.length === 0) {
    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
    if (ogImage) covers.push({ url: ogImage, title: 'Capa Principal' });
  }

  const chapters = Array.from(document.querySelectorAll('.chapter-list a')).map((el, i, arr) => ({
    title: el.textContent?.trim() || 'Cap ' + (i + 1),
    url: el.href,
    index: i + 1,
    isFinal: i === arr.length - 1
  }));

  return { covers, chapters };
})()`,
	})
	@IsString()
	@IsOptional()
	bookInfoExtractScript?: string;

	@ApiPropertyOptional({
		description:
			'Optional concurrency limit for simultaneous scrapes of this site. Null or omitted = unlimited',
		example: 3,
	})
	@IsOptional()
	@IsInt()
	concurrencyLimit?: number;

	@ApiPropertyOptional({
		description:
			'Blacklist terms: URLs containing these terms will be ignored',
		example: ['logo', 'icon', 'avatar', 'ads', 'banner', 'sprite', '.gif'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	blacklistTerms?: string[];

	@ApiPropertyOptional({
		description:
			'Whitelist terms: If filled, only URLs containing these terms will be accepted',
		example: ['cdn.site.com', 'uploads/chapters'],
		type: [String],
		isArray: true,
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	whitelistTerms?: string[];

	@ApiPropertyOptional({
		description:
			'Enable network traffic interception for image caching (more efficient)',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	useNetworkInterception?: boolean;

	@ApiPropertyOptional({
		description:
			'Use screenshot/print mode to capture images instead of downloading. Captures in PNG (lossless) for maximum quality. Useful for canvas-rendered images or sites with download protection.',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	useScreenshotMode?: boolean;

	@ApiPropertyOptional({
		description:
			'Cookies to inject before navigation. Useful for language settings, consent bypassing, etc.',
		type: [CookieConfigDto],
		example: [
			{ name: 'lang', value: 'en' },
			{ name: 'gdpr_accepted', value: 'true' },
			{ name: 'adult_content', value: '1' },
		],
	})
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CookieConfigDto)
	cookies?: CookieConfigDto[];

	@ApiPropertyOptional({
		description:
			'localStorage items to inject after page load. Keys and values as strings.',
		example: {
			reader_mode: 'vertical',
			image_fit: 'width',
			language: 'en-US',
		},
	})
	@IsOptional()
	@IsObject()
	localStorage?: Record<string, string>;

	@ApiPropertyOptional({
		description:
			'sessionStorage items to inject after page load. Keys and values as strings.',
		example: {
			verified_age: 'true',
			session_quality: 'high',
		},
	})
	@IsOptional()
	@IsObject()
	sessionStorage?: Record<string, string>;

	@ApiPropertyOptional({
		description:
			'Whether to reload the page after injecting localStorage/sessionStorage. Some sites read configs only on initial load.',
		example: false,
		default: false,
	})
	@IsOptional()
	@IsBoolean()
	reloadAfterStorageInjection?: boolean;

	@ApiPropertyOptional({
		description:
			'Enable adaptive timeouts based on page size. Longer pages automatically get larger timeouts.',
		example: true,
		default: true,
	})
	@IsOptional()
	@IsBoolean()
	enableAdaptiveTimeouts?: boolean;

	@ApiPropertyOptional({
		description:
			'Custom timeout multipliers by page size. If not specified, uses defaults: small=1.0, medium=1.5, large=2.0, huge=3.0',
		example: {
			small: 1.0,
			medium: 2.0,
			large: 3.0,
			huge: 4.0,
		},
	})
	@IsOptional()
	@IsObject()
	timeoutMultipliers?: Record<string, number>;
}
