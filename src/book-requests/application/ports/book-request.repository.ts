import { BookRequest } from '../../domain/entities/book-request';

export interface BookRequestRepository {
	save(bookRequest: BookRequest): Promise<void>;
	findById(id: string): Promise<BookRequest | null>;
	findAll(): Promise<BookRequest[]>;
	findByUserId(userId: string): Promise<BookRequest[]>;
}

export const I_BOOK_REQUEST_REPOSITORY = 'BookRequestRepository';
