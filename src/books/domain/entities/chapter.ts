import { ContentFormat } from '../enums/content-format.enum';
import { ContentType } from '../enums/content-type.enum';
import { DocumentFormat } from '../enums/document-format.enum';
import { ScrapingStatus } from '../enums/scrapingStatus.enum';
import { Book } from './book';
import { ChapterComment } from './chapter-comment';
import { Page } from './page';

export class Chapter {
	id: string;
	title: string | null;
	originalUrl: string;
	index: number;
	contentType: ContentType;
	content: string | null;
	contentFormat: ContentFormat | null;
	documentPath: string | null;
	documentFormat: DocumentFormat | null;
	scrapingStatus: ScrapingStatus | null;
	retries: number;
	book: Book;
	pages: Page[];
	comments: ChapterComment[];
	isFinal: boolean;
	deletedAt: Date | null;
}
