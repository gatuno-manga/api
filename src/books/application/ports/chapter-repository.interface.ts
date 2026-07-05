import { Chapter } from '@books/domain/entities/chapter';
import {
	ChapterCriteria,
	ChapterQueryOptions,
} from '@books/domain/types/criteria.types';

export interface ChapterNavigation {
	chapter: Chapter;
	previousId?: string;
	nextId?: string;
	totalChapters: number;
}

export interface IChapterRepository {
	findById(
		id: string,
		relations?: string[],
		comment?: string,
	): Promise<Chapter | null>;
	save(chapter: Chapter): Promise<Chapter>;
	saveAll(chapters: Chapter[]): Promise<Chapter[]>;
	update(id: string, data: Partial<Chapter>): Promise<void>;
	delete(id: string): Promise<void>;
	softDelete(id: string): Promise<void>;
	softRemove(chapter: Chapter): Promise<void>;
	exists(id: string): Promise<boolean>;
	findByIds(ids: string[]): Promise<Chapter[]>;
	findByBookIds(bookIds: string[]): Promise<Chapter[]>;
	count(criteria?: ChapterCriteria): Promise<number>;
	findByBookId(
		bookId: string,
		options?: ChapterQueryOptions,
	): Promise<Chapter[]>;
	findOne(criteria: ChapterCriteria): Promise<Chapter | null>;
	find(criteria: ChapterCriteria): Promise<Chapter[]>;
	findWithRelations(id: string, relations: string[]): Promise<Chapter | null>;
	findChaptersByBookIdWithCursor(
		bookId: string,
		options: ChapterQueryOptions,
		userId?: string,
	): Promise<Record<string, unknown>[]>;
	findChaptersWithError(bookId: string): Promise<Chapter[]>;
	findAvailableLanguagesByBookId(bookId: string): Promise<string[]>;
	findWithNavigation(id: string): Promise<ChapterNavigation | null>;
	create(data: Partial<Chapter>): Chapter;
	merge(chapter: Chapter, data: Partial<Chapter>): Chapter;
	createQueryBuilder(alias: string): unknown;
}

export const I_CHAPTER_REPOSITORY = 'IChapterRepository';
