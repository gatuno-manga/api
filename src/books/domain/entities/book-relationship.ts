import { BookRelationType } from '../enums/book-relation-type.enum';
import { Book } from './book';

export type BookRelationshipMetadata = {
	note?: string;
	weight?: number;
};

export class BookRelationship {
	id: string;
	sourceBookId: string;
	targetBookId: string;
	relationType: BookRelationType;
	isBidirectional: boolean;
	order: number | null;
	metadata: BookRelationshipMetadata | null;
	sourceBook: Book;
	targetBook: Book;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}
