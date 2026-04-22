import { Tag } from '../../domain/entities/tag';
import { TagsOptions } from '../dto/tags-options.dto';
import { TagCriteria } from '@books/domain/types/criteria.types';

export interface ITagRepository {
	findById(id: string, relations?: string[]): Promise<Tag | null>;
	findAll(): Promise<Tag[]>;
	save(tag: Tag): Promise<Tag>;
	remove(tags: Tag[]): Promise<void>;
	deleteByIds(ids: string[]): Promise<void>;
	findByName(name: string): Promise<Tag | null>;
	exists(id: string): Promise<boolean>;
	findWithFilters(options: TagsOptions, maxWeight?: number): Promise<Tag[]>;
	count(criteria?: TagCriteria): Promise<number>;
}

export const I_TAG_REPOSITORY = 'ITagRepository';
