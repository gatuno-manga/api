import { Chapter } from './chapter';

export class Page {
	id: number;
	index: number;
	chapter: Chapter;
	path: string;
	width: number | null;
	height: number | null;
	deletedAt: Date | null;
}
