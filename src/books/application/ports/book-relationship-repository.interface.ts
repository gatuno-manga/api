import { BookRelationship } from '../../domain/entities/book-relationship';
import { BookRelationshipCriteria } from '@books/domain/types/criteria.types';

export interface IBookRelationshipRepository {
	findById(id: string): Promise<BookRelationship | null>;
	save(relationship: BookRelationship): Promise<BookRelationship>;
	findOneBy(
		criteria: BookRelationshipCriteria,
	): Promise<BookRelationship | null>;
	softDelete(id: string): Promise<void>;
	findRelationshipsByBookId(bookId: string): Promise<BookRelationship[]>;
}

export const I_BOOK_RELATIONSHIP_REPOSITORY = 'IBookRelationshipRepository';
