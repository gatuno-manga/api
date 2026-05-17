import { ChapterComment } from '@books/domain/entities/chapter-comment';
import {
	PaginationOptions,
	ViewerContext,
} from '@books/domain/types/criteria.types';

export interface IChapterCommentRepository {
	findById(
		id: string,
		relations?: string[],
		comment?: string,
	): Promise<ChapterComment | null>;
	save(comment: ChapterComment): Promise<ChapterComment>;
	softRemove(comment: ChapterComment): Promise<void>;
	countRoots(chapterId: string, viewer?: ViewerContext): Promise<number>;
	findRootsWithPagination(
		chapterId: string,
		options: PaginationOptions,
		viewer?: ViewerContext,
	): Promise<ChapterComment[]>;
	findRootsWithCursor(
		chapterId: string,
		options: PaginationOptions,
		viewer?: ViewerContext,
	): Promise<ChapterComment[]>;
	findDescendantsByRoots(
		chapterId: string,
		rootIds: string[],
		maxDepth: number,
		viewer?: ViewerContext,
	): Promise<ChapterComment[]>;
	create(data: Partial<ChapterComment>): ChapterComment;
}

export const I_CHAPTER_COMMENT_REPOSITORY = 'IChapterCommentRepository';
