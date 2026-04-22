import { Chapter } from './chapter';
import { User } from 'src/users/domain/entities/user'; // Wait, I need to check where user domain entity is

export class ChapterComment {
	id: string;
	chapter: Chapter;
	user: User;
	userName: string;
	parent: ChapterComment | null;
	replies: ChapterComment[];
	content: string;
	isPublic: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
}
