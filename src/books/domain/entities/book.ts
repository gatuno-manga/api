import { BookType } from '@books/domain/enums/book-type.enum';
import { ExportFormat } from '@books/domain/enums/export-format.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { AlternativeTitle } from './alternative-title';
import { Author } from './author';
import { Chapter } from './chapter';
import { Cover } from './cover';
import { SensitiveContent } from './sensitive-content';
import { Tag } from './tag';

export class Book {
	id: string;
	title: string;
	covers: Cover[];
	alternativeTitles: AlternativeTitle[];
	searchTerms: string[];
	type: BookType;
	sensitiveContent: SensitiveContent[];
	originalUrl: string[];
	description: string | null;
	publication: number | null;
	scrapingStatus: ScrapingStatus;
	autoUpdate: boolean;
	availableFormats: ExportFormat[] | null;
	chapters: Chapter[];
	tags: Tag[];
	authors: Author[];
	originalLanguageCode: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}
