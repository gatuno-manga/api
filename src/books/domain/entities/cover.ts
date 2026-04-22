import { Book } from './book';

export class Cover {
	id: string;
	url: string;
	title: string;
	index: number;
	imageHash: string | null;
	originalUrl: string | null;
	selected: boolean;
	book: Book;
	deletedAt: Date | null;
}
