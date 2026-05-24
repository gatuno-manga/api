import { AuthorBiography } from './author-biography';
import { Book } from './book';

export class Author {
	id: string;
	name: string;
	localizedBiographies: AuthorBiography[];
	biography: string | null; // Keep for legacy return mapping
	createdAt: Date;
	updatedAt: Date;
	books: Book[];
}
