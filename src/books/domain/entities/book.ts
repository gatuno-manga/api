import { BookType } from '@books/domain/enums/book-type.enum';
import { ExportFormat } from '@books/domain/enums/export-format.enum';
import { PublicationStatus } from '@books/domain/enums/publication-status.enum';
import { ScrapingStatus } from '@books/domain/enums/scrapingStatus.enum';
import { AlternativeTitle } from './alternative-title';
import { Author } from './author';
import { BookDescription } from './book-description';
import { Chapter } from './chapter';
import { Cover } from './cover';
import { SensitiveContent } from './sensitive-content';
import { Tag } from './tag';

export class Book {
	id: string;
	title: string;
	covers: Cover[];
	alternativeTitles: AlternativeTitle[];
	localizedDescriptions: BookDescription[];
	searchTerms: string[];
	type: BookType;
	sensitiveContent: SensitiveContent[];
	originalUrl: string[];
	description: string | null; // Keep for legacy return mapping
	publication: number | null;
	scrapingStatus: ScrapingStatus;
	publicationStatus: PublicationStatus;
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
