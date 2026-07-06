import { Author } from '@books/domain/entities/author';
import { Book } from '@books/domain/entities/book';
import { BookRelationship } from '@books/domain/entities/book-relationship';
import { Chapter } from '@books/domain/entities/chapter';
import { ChapterComment } from '@books/domain/entities/chapter-comment';
import { ChapterRead } from '@books/domain/entities/chapter-read';
import { Page } from '@books/domain/entities/page';
import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { Tag } from '@books/domain/entities/tag';

// Basic criteria based on entity fields
export type Criteria<T> = {
	[P in keyof T]?: T[P];
};

export type BookCriteria = Criteria<Book>;
export type ChapterCriteria = Criteria<Chapter>;
export type PageCriteria = Criteria<Page>;
export type AuthorCriteria = Criteria<Author>;
export type TagCriteria = Criteria<Tag>;
export type SensitiveContentCriteria = Criteria<SensitiveContent>;
export type BookRelationshipCriteria = Criteria<BookRelationship>;
export type ChapterReadCriteria = Criteria<ChapterRead>;
export type ChapterCommentCriteria = Criteria<ChapterComment>;

export type PaginationOptions = {
	limit?: number;
	offset?: number;
	page?: number;
};

export type ChapterQueryOptions = PaginationOptions & {
	order?: 'ASC' | 'DESC';
	cursorIndex?: number | null;
	languageCode?: string;
};

export type ViewerContext = {
	userId?: string;
	roles?: string[];
};

export type AccessContext = {
	blockedAll?: boolean;
	blocked?: boolean;
	effectiveMaxWeightSensitiveContent: number;
	denyBookIds?: string[];
	denyTagIds?: string[];
	allowBookIds?: string[];
	allowTagIds?: string[];
	denySensitiveContentIds?: string[];
	allowSensitiveContentIds?: string[];
	allowBookWeightById?: Record<string, number>;
	allowTagWeightById?: Record<string, number>;
};

export type DeepPartial<T> = T extends (...args: unknown[]) => unknown
	? T
	: T extends Array<infer U>
		? _DeepPartialArray<U>
		: T extends object
			? _DeepPartialObject<T>
			: T | undefined;
export type _DeepPartialArray<T> = Array<DeepPartial<T>>;
export type _DeepPartialObject<T> = { [P in keyof T]?: DeepPartial<T[P]> };
