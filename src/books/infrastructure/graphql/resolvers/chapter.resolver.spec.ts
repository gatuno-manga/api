import { BookDataLoaderService } from '@books/application/services/book-dataloader.service';
import { ChapterService } from '@books/application/services/chapter.service';
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CurrentUserDto } from 'src/auth/application/dto/current-user.dto';
import { GqlJwtAuthGuard } from 'src/auth/infrastructure/framework/gql-jwt-auth.guard';
import { PermissionsGuard } from 'src/users/application/services/permissions.guard';
import { ChapterModel } from '../models/chapter.model';
import { ChapterResolver } from './chapter.resolver';

describe('ChapterResolver', () => {
	let resolver: ChapterResolver;
	let chapterService: Record<string, jest.Mock>;
	let chapterReadLoader: jest.Mock;
	let load: jest.Mock;

	const user = { userId: 'user-1' } as CurrentUserDto;
	const chapter = { id: 'chapter-1' } as ChapterModel;

	beforeEach(async () => {
		chapterService = {
			getChapter: jest.fn().mockResolvedValue(chapter),
			markChapterAsRead: jest.fn().mockResolvedValue({}),
			markChapterAsUnread: jest.fn().mockResolvedValue({}),
			markChaptersAsRead: jest.fn(),
			markChaptersAsUnread: jest.fn(),
		};
		load = jest.fn();
		chapterReadLoader = jest.fn(() => ({ load }));

		const module = await Test.createTestingModule({
			providers: [
				ChapterResolver,
				{ provide: ChapterService, useValue: chapterService },
				{
					provide: BookDataLoaderService,
					useValue: { chapterReadLoader },
				},
			],
		})
			// Guards are covered by the e2e suite; here they only need to exist.
			.overrideGuard(GqlJwtAuthGuard)
			.useValue({ canActivate: () => true })
			.overrideGuard(PermissionsGuard)
			.useValue({ canActivate: () => true })
			.compile();

		resolver = await module.resolve(ChapterResolver);
	});

	describe('read field', () => {
		it('is null for an anonymous caller and does not query', async () => {
			await expect(resolver.resolveRead(chapter)).resolves.toBeNull();
			await expect(
				resolver.resolveRead(chapter, {} as CurrentUserDto),
			).resolves.toBeNull();
			expect(chapterReadLoader).not.toHaveBeenCalled();
		});

		it('uses a read value the parent already resolved', async () => {
			await expect(
				resolver.resolveRead({ ...chapter, read: false }, user),
			).resolves.toBe(false);
			expect(chapterReadLoader).not.toHaveBeenCalled();
		});

		it('stays null for an anonymous caller even if the parent has a value', async () => {
			await expect(
				resolver.resolveRead({ ...chapter, read: true }),
			).resolves.toBeNull();
		});

		it("goes through the caller's read loader", async () => {
			load.mockResolvedValue(true);

			await expect(resolver.resolveRead(chapter, user)).resolves.toBe(
				true,
			);
			expect(chapterReadLoader).toHaveBeenCalledWith('user-1');
			expect(load).toHaveBeenCalledWith('chapter-1');
		});
	});

	describe('markChapterRead', () => {
		it('marks the chapter read and returns it', async () => {
			// The mutation knows the new state; a re-read could hit a lagging replica.
			await expect(
				resolver.markChapterRead('chapter-1', user),
			).resolves.toEqual({ ...chapter, read: true });
			expect(chapterService.markChapterAsRead).toHaveBeenCalledWith(
				'chapter-1',
				'user-1',
			);
			expect(chapterService.getChapter).toHaveBeenCalledWith('chapter-1');
		});

		it('propagates a missing chapter', async () => {
			chapterService.markChapterAsRead.mockRejectedValue(
				new NotFoundException(),
			);

			await expect(
				resolver.markChapterRead('missing', user),
			).rejects.toBeInstanceOf(NotFoundException);
			expect(chapterService.getChapter).not.toHaveBeenCalled();
		});
	});

	describe('markChapterUnread', () => {
		it('marks the chapter unread and returns it', async () => {
			await expect(
				resolver.markChapterUnread('chapter-1', user),
			).resolves.toEqual({ ...chapter, read: false });
			expect(chapterService.markChapterAsUnread).toHaveBeenCalledWith(
				'chapter-1',
				'user-1',
			);
			expect(chapterService.getChapter).toHaveBeenCalledWith('chapter-1');
		});
	});

	describe('batch mutations', () => {
		it('markChaptersRead returns one result per id', async () => {
			chapterService.markChaptersAsRead.mockResolvedValue([
				{ chapterId: 'c1', success: true, result: {} },
				{ chapterId: 'c2', success: false, error: 'not found' },
			]);

			await expect(
				resolver.markChaptersRead(['c1', 'c2'], user),
			).resolves.toEqual([
				{ chapterId: 'c1', success: true, error: null },
				{ chapterId: 'c2', success: false, error: 'not found' },
			]);
			expect(chapterService.markChaptersAsRead).toHaveBeenCalledWith(
				['c1', 'c2'],
				'user-1',
			);
		});

		it('markChaptersUnread returns one result per id', async () => {
			chapterService.markChaptersAsUnread.mockResolvedValue([
				{ chapterId: 'c1', success: true, result: {} },
			]);

			await expect(
				resolver.markChaptersUnread(['c1'], user),
			).resolves.toEqual([
				{ chapterId: 'c1', success: true, error: null },
			]);
			expect(chapterService.markChaptersAsUnread).toHaveBeenCalledWith(
				['c1'],
				'user-1',
			);
		});
	});
});
