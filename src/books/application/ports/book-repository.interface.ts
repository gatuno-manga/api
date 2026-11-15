import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { FilterStrategy } from '@books/application/strategies';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { Book } from '@books/domain/entities/book';
import {
	AccessContext,
	BookCriteria,
	BookListPosition,
	PositionedBook,
} from '@books/domain/types/criteria.types';

export interface IBookRepository {
	findById(
		id: string,
		relations?: string[],
		comment?: string,
	): Promise<Book | null>;
	findByIdWithDetails(id: string, comment?: string): Promise<Book | null>;
	save(book: Book): Promise<Book>;
	update(id: string, data: Partial<Book>): Promise<void>;
	delete(id: string): Promise<void>;
	softDelete(id: string): Promise<void>;
	exists(id: string): Promise<boolean>;
	count(criteria?: BookCriteria): Promise<number>;
	findByTitle(title: string): Promise<Book | null>;
	findOne(criteria: BookCriteria): Promise<Book | null>;
	findWithFilters(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
	): Promise<[Book[], number]>;
	/**
	 * Keyset page of `findWithFilters`: up to `take` books strictly after
	 * `after` in the list order (from the start when `after` is null), each
	 * with its position. Runs no COUNT.
	 */
	findWithFiltersAfter(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
		after: BookListPosition | null,
		take: number,
	): Promise<PositionedBook[]>;
	findRandom(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
	): Promise<Book | null>;
	findAllInProcess(): Promise<Book[]>;
	findByIdsPreservingOrder(ids: string[]): Promise<Book[]>;
	/**
	 * Returns copies of the given books with `tags`, `authors` (without
	 * biographies) and `sensitiveContent` loaded; `[]` when a book has none.
	 */
	loadListRelations(books: Book[]): Promise<Book[]>;
	checkBookTitleConflict(
		title: string,
		alternativeTitles: string[],
	): Promise<{
		conflict: boolean;
		existingBook?: {
			id: string;
			title: string;
			alternativeTitles?: AlternativeTitle[];
		};
		conflictingBooks?: Array<{
			id: string;
			title: string;
			alternativeTitles?: AlternativeTitle[];
		}>;
	}>;
	findBooksWithCoverIssues(
		page: number,
		limit: number,
	): Promise<[Book[], number]>;
}

export const I_BOOK_REPOSITORY = 'IBookRepository';
