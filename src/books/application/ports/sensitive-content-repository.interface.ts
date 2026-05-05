import { SensitiveContent } from '@books/domain/entities/sensitive-content';
import { SensitiveContentCriteria } from '@books/domain/types/criteria.types';

export interface ISensitiveContentRepository {
	findById(
		id: string,
		relations?: string[],
	): Promise<SensitiveContent | null>;
	findAll(maxWeight?: number): Promise<SensitiveContent[]>;
	save(content: SensitiveContent): Promise<SensitiveContent>;
	remove(content: SensitiveContent): Promise<void>;
	deleteByIds(ids: string[]): Promise<void>;
	findByName(name: string): Promise<SensitiveContent | null>;
	findByNames(names: string[], weight: number): Promise<SensitiveContent[]>;
	count(criteria?: SensitiveContentCriteria): Promise<number>;
}

export const I_SENSITIVE_CONTENT_REPOSITORY = 'ISensitiveContentRepository';
