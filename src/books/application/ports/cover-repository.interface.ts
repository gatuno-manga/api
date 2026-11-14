import { Cover } from '@books/domain/entities/cover';
import { ImageVariant } from 'src/common/domain/value-objects/image-variant.vo';

export interface ICoverRepository {
	findById(id: string, relations?: string[]): Promise<Cover | null>;
	save(cover: Cover): Promise<Cover>;
	saveAll(covers: Cover[]): Promise<Cover[]>;
	delete(id: string): Promise<void>;
	softDelete(id: string): Promise<void>;
	softRemove(cover: Cover): Promise<void>;
	find(criteria: Partial<Cover>): Promise<Cover[]>;
	findByBookId(bookId: string, comment?: string): Promise<Cover[]>;
	findByBookIds(bookIds: string[]): Promise<Cover[]>;
	create(data: Partial<Cover>): Cover;
	update(criteria: Partial<Cover>, data: Partial<Cover>): Promise<void>;
	updateBatch(
		updates: {
			oldPath: string;
			newPath: string;
			metadata?: unknown;
			originalUrl?: string;
			variants?: ImageVariant[];
		}[],
	): Promise<void>;
	findStuckCovers(hours: number): Promise<Cover[]>;
}

export const I_COVER_REPOSITORY = 'ICoverRepository';
