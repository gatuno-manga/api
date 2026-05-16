import { Chapter } from './chapter';
import { Page } from './page';
import { ContentType } from '@books/domain/enums/content-type.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';

describe('Chapter Entity', () => {
	it('should create a chapter instance', () => {
		const chapter = new Chapter();
		chapter.id = 'chapter-1';
		chapter.title = 'Chapter 1';
		chapter.index = 1;
		chapter.contentType = ContentType.IMAGE;
		chapter.scrapingStatus = ScrapingStatus.READY;
		chapter.pages = [];
		chapter.isFinal = false;

		expect(chapter.id).toBe('chapter-1');
		expect(chapter.title).toBe('Chapter 1');
		expect(chapter.index).toBe(1);
		expect(chapter.contentType).toBe(ContentType.IMAGE);
		expect(chapter.scrapingStatus).toBe(ScrapingStatus.READY);
		expect(chapter.pages).toEqual([]);
		expect(chapter.isFinal).toBe(false);
	});
});

describe('Page Entity', () => {
	it('should create a page instance', () => {
		const page = new Page();
		page.id = 1;
		page.index = 1;
		page.path = 'page1.jpg';

		expect(page.id).toBe(1);
		expect(page.index).toBe(1);
		expect(page.path).toBe('page1.jpg');
	});
});
