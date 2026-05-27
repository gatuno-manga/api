import { BookPageOptionsDto } from '@books/application/dto/book-page-options.dto';
import { FilterStrategy } from '@books/application/strategies';
import { AlternativeTitle } from '@books/domain/entities/alternative-title';
import { Book } from '@books/domain/entities/book';
import {
	AccessContext,
	BookCriteria,
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
	findRandom(
		options: BookPageOptionsDto,
		accessContext: AccessContext,
		filterStrategies: FilterStrategy[],
	): Promise<Book | null>;
	findAllInProcess(): Promise<Book[]>;
	findByIdsPreservingOrder(ids: string[]): Promise<Book[]>;
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
}

export const I_BOOK_REPOSITORY = 'IBookRepository';
