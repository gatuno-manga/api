import { Book } from './book';

export class Author {
	id: string;
	name: string;
	biography: string | null;
	createdAt: Date;
	updatedAt: Date;
	books: Book[];
}
