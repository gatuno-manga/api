import { Author } from '../../domain/entities/author';
import { AuthorsOptions } from '../dto/authors-options.dto';
import { AuthorCriteria } from '@books/domain/types/criteria.types';

export interface IAuthorRepository {
	findById(id: string, relations?: string[]): Promise<Author | null>;
	save(author: Author): Promise<Author>;
	remove(authors: Author[]): Promise<void>;
	deleteByIds(ids: string[]): Promise<void>;
	findByName(name: string): Promise<Author | null>;
	findWithFilters(
		options: AuthorsOptions,
		maxWeight?: number,
	): Promise<Author[]>;
	count(criteria?: AuthorCriteria): Promise<number>;
}

export const I_AUTHOR_REPOSITORY = 'IAuthorRepository';
