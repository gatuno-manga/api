import { Chapter } from './chapter';

export class Page {
	id: number;
	index: number;
	chapter: Chapter;
	path: string;
	deletedAt: Date | null;
}
