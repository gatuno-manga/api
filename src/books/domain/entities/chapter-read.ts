import { User } from 'src/users/domain/entities/user';
import { Chapter } from './chapter';

export class ChapterRead {
	id: number;
	user: User;
	chapter: Chapter;
	readAt: Date;
}
