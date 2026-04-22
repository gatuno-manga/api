import { ChapterRead } from '../../domain/entities/chapter-read';
import { ChapterReadCriteria } from '@books/domain/types/criteria.types';

export interface IChapterReadRepository {
	save(chapterRead: ChapterRead): Promise<ChapterRead>;
	findOneBy(criteria: ChapterReadCriteria): Promise<ChapterRead | null>;
	delete(criteria: ChapterReadCriteria): Promise<void>;
	create(data: Partial<ChapterRead>): ChapterRead;
}

export const I_CHAPTER_READ_REPOSITORY = 'IChapterReadRepository';
