import { Cover } from '../../domain/entities/cover';

export interface ICoverRepository {
	findById(id: string, relations?: string[]): Promise<Cover | null>;
	save(cover: Cover): Promise<Cover>;
	saveAll(covers: Cover[]): Promise<Cover[]>;
	delete(id: string): Promise<void>;
	softDelete(id: string): Promise<void>;
	softRemove(cover: Cover): Promise<void>;
	findByBookId(bookId: string): Promise<Cover[]>;
	create(data: Partial<Cover>): Cover;
	update(criteria: unknown, data: Partial<Cover>): Promise<void>;
	updateBatch(
		updates: { oldPath: string; newPath: string; metadata?: unknown }[],
	): Promise<void>;
}

export const I_COVER_REPOSITORY = 'ICoverRepository';
