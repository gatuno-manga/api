import { BookPageOptionsDto } from '../dto/book-page-options.dto';
import { Book } from '../../domain/entities/book';
import { FilterStrategy } from '../strategies';
import {
	BookCriteria,
	AccessContext,
} from '@books/domain/types/criteria.types';

export interface IBookRepository {
	findById(id: string, relations?: string[]): Promise<Book | null>;
	findByIdWithDetails(id: string): Promise<Book | null>;
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
	checkBookTitleConflict(
		title: string,
		alternativeTitles: string[],
	): Promise<{
		conflict: boolean;
		existingBook?: {
			id: string;
			title: string;
			alternativeTitle?: string[];
		};
		conflictingBooks?: Array<{
			id: string;
			title: string;
			alternativeTitle?: string[];
		}>;
	}>;
}

export const I_BOOK_REPOSITORY = 'IBookRepository';
