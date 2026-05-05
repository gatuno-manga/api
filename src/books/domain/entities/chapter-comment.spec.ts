import { ChapterComment } from './chapter-comment';
import { ChapterRead } from './chapter-read';
import { Chapter } from './chapter';
import { User } from '@users/domain/entities/user';

describe('ChapterComment Entity', () => {
	it('should create a chapter comment instance', () => {
		const comment = new ChapterComment();
		const user = new User();
		user.id = 'user-1';
		user.userName = 'testuser';

		comment.id = 'comment-1';
		comment.content = 'Great chapter!';
		comment.user = user;
		comment.userName = user.userName;
		comment.isPublic = true;
		comment.replies = [];

		expect(comment.id).toBe('comment-1');
		expect(comment.content).toBe('Great chapter!');
		expect(comment.user.id).toBe('user-1');
		expect(comment.userName).toBe('testuser');
		expect(comment.isPublic).toBe(true);
		expect(comment.replies).toEqual([]);
	});
});

describe('ChapterRead Entity', () => {
	it('should create a chapter read instance', () => {
		const chapterRead = new ChapterRead();
		const chapter = new Chapter();
		chapter.id = 'chapter-1';

		const user = new User();
		user.id = 'user-1';

		chapterRead.id = 1;
		chapterRead.chapter = chapter;
		chapterRead.user = user;
		chapterRead.readAt = new Date();

		expect(chapterRead.id).toBe(1);
		expect(chapterRead.chapter.id).toBe('chapter-1');
		expect(chapterRead.user.id).toBe('user-1');
		expect(chapterRead.readAt).toBeInstanceOf(Date);
	});
});
