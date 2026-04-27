import { Page } from '../../domain/entities/page';
import { PageCriteria } from '@books/domain/types/criteria.types';

export interface IPageRepository {
	findById(id: number): Promise<Page | null>;
	save(page: Page): Promise<Page>;
	saveAll(pages: Page[]): Promise<Page[]>;
	delete(criteria: PageCriteria): Promise<void>;
	softDelete(criteria: PageCriteria): Promise<void>;
	softRemove(pages: Page[]): Promise<void>;
	findByChapterId(chapterId: string): Promise<Page[]>;
	count(criteria?: PageCriteria): Promise<number>;
	create(data: Partial<Page>): Page;
	update(criteria: PageCriteria, data: Partial<Page>): Promise<void>;
	updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void>;
}

export const I_PAGE_REPOSITORY = 'IPageRepository';
