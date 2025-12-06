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
